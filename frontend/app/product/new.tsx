import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, apiPut, fileUrl, uploadImage } from "@/src/api";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, Field, Icon } from "@/src/components/ui";
import { Header } from "@/src/components/header";
import { useToast } from "@/src/components/toast";
import { pickFromGallery, takePhoto } from "@/src/hooks/useImageCapture";

export default function ProductForm() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string; name?: string; botanical?: string }>();
  const editing = !!params.id;

  const existing = useQuery({
    queryKey: ["product", params.id],
    queryFn: () => apiGet(`/products/${params.id}`),
    enabled: editing,
  });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => apiGet("/categories") });

  const [name, setName] = useState(params.name ?? "");
  const [botanical, setBotanical] = useState(params.botanical ?? "");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [minStock, setMinStock] = useState("5");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [permDenied, setPermDenied] = useState(false);

  useEffect(() => {
    if (existing.data) {
      const p = existing.data;
      setName(p.name);
      setBotanical(p.botanical_name || "");
      setCategory(p.category || "");
      setStock(String(p.stock));
      setCost(String(p.cost_price));
      setPrice(String(p.selling_price));
      setSupplier(p.supplier || "");
      setMinStock(String(p.min_stock));
      setPhotoPath(p.photo_path || null);
    }
  }, [existing.data]);

  async function capture(source: "camera" | "gallery") {
    setPermDenied(false);
    const outcome = source === "camera" ? await takePhoto() : await pickFromGallery();
    if (outcome.status === "denied") {
      setPermDenied(true);
      return;
    }
    if (outcome.status !== "ok") return;
    setLocalUri(outcome.result.uri);
    setBase64(outcome.result.base64);
    setUploading(true);
    try {
      const path = await uploadImage(outcome.result.uri);
      setPhotoPath(path);
    } catch (e: any) {
      toast.show("Photo upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  async function identify() {
    if (!base64) return;
    setIdentifying(true);
    try {
      const r = await apiPost("/ai/identify-plant", { image_base64: base64 });
      if (r.plant_name) setName(r.plant_name);
      if (r.scientific_name) setBotanical(r.scientific_name);
      toast.show(`Identified: ${r.plant_name} (${r.confidence}%)`, "success");
    } catch (e: any) {
      toast.show("Could not identify", "error");
    } finally {
      setIdentifying(false);
    }
  }

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        botanical_name: botanical.trim(),
        category,
        photo_path: photoPath,
        cost_price: Number(cost) || 0,
        selling_price: Number(price) || 0,
        stock: Number(stock) || 0,
        min_stock: Number(minStock) || 0,
        supplier: supplier.trim(),
      };
      return editing ? apiPut(`/products/${params.id}`, body) : apiPost("/products", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (editing) qc.invalidateQueries({ queryKey: ["product", params.id] });
      toast.show(editing ? "Product updated" : "Product added", "success");
      router.back();
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={editing ? "Edit Product" : "Add Inventory"} />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}
        bottomOffset={20}
      >
        {/* Photo */}
        <View style={s.photoBox}>
          {localUri || photoPath ? (
            <Image source={{ uri: localUri || fileUrl(photoPath) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <Icon name="camera-plus" size={48} color={colors.brandPrimary} />
          )}
          {uploading && (
            <View style={s.photoOverlay}>
              <Icon name="loading" size={28} color="#FFFFFF" />
            </View>
          )}
        </View>
        {permDenied && (
          <View style={s.permCard}>
            <Text style={s.permText}>Camera access is needed.</Text>
            <Button title="Open Settings" variant="outline" size="md" icon="cog" onPress={() => Linking.openSettings()} testID="product-open-settings" />
          </View>
        )}
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Button title="Take Photo" icon="camera" size="md" onPress={() => capture("camera")} style={{ flex: 1 }} testID="product-take-photo" />
          <Button title="Gallery" icon="image" size="md" variant="secondary" onPress={() => capture("gallery")} style={{ flex: 1 }} testID="product-gallery" />
        </View>
        {base64 && (
          <Button title="Identify with AI" icon="creation" variant="outline" size="md" onPress={identify} loading={identifying} testID="product-identify" />
        )}

        <Field label="Product Name" placeholder="e.g. Money Plant" value={name} onChangeText={setName} testID="product-name" />
        <Field label="Botanical Name (optional)" placeholder="e.g. Epipremnum aureum" value={botanical} onChangeText={setBotanical} testID="product-botanical" />

        <Text style={s.label}>Category</Text>
        <View style={s.chipWrap}>
          {(categories.data ?? []).map((c: any) => (
            <Pressable key={c.id} testID={`product-cat-${c.name}`} style={[s.chip, category === c.name && s.chipActive]} onPress={() => setCategory(c.name)}>
              <Text style={[s.chipText, category === c.name && { color: colors.onBrandPrimary }]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Field label="Cost Price ₹" placeholder="0" value={cost} onChangeText={setCost} keyboardType="numeric" style={{ flex: 1 }} testID="product-cost" />
          <Field label="Selling Price ₹" placeholder="0" value={price} onChangeText={setPrice} keyboardType="numeric" style={{ flex: 1 }} testID="product-price" />
        </View>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Field label={editing ? "Stock (use Adjust to change)" : "Quantity"} placeholder="0" value={stock} onChangeText={setStock} keyboardType="numeric" editable={!editing} style={{ flex: 1 }} testID="product-stock" />
          <Field label="Min Stock" placeholder="5" value={minStock} onChangeText={setMinStock} keyboardType="numeric" style={{ flex: 1 }} testID="product-min-stock" />
        </View>
        <Field label="Supplier (optional)" placeholder="Supplier name" value={supplier} onChangeText={setSupplier} testID="product-supplier" />

        <Button
          title={editing ? "Save Changes" : "Save Inventory"}
          icon="content-save"
          onPress={() => save.mutate()}
          disabled={!name.trim() || uploading}
          loading={save.isPending}
          testID="product-save"
          style={{ marginTop: spacing.md }}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  photoBox: {
    width: "100%",
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoOverlay: {
    ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const),
    backgroundColor: "rgba(11,18,12,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  permCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  permText: { fontSize: 16, color: colors.onSurface },
  label: { fontSize: 15, fontWeight: "600", color: colors.onSurfaceSecondary },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { fontSize: 14, fontWeight: "700", color: colors.onSurfaceTertiary },
}));
