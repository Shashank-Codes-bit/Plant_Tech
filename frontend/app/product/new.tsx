import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, apiPut, fileUrl, uploadImage } from "@/src/api";
import { useCart } from "@/src/cart-context";
import { formatCurrency } from "@/src/format";
import { takePendingPhoto } from "@/src/pending-photo";
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
  // mode=sell: opened from Scan for a plant that isn't in stock; saving adds it to the bill.
  const params = useLocalSearchParams<{ id?: string; name?: string; botanical?: string; category?: string; mode?: string }>();
  const editing = !!params.id;
  const selling = params.mode === "sell" && !editing;
  const { addItem } = useCart();

  const existing = useQuery({
    queryKey: ["product", params.id],
    queryFn: () => apiGet(`/products/${params.id}`),
    enabled: editing,
  });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => apiGet("/categories") });

  const [name, setName] = useState(params.name ?? "");
  const [botanical, setBotanical] = useState(params.botanical ?? "");
  const [category, setCategory] = useState(params.category ?? "");
  const [stock, setStock] = useState(selling ? "1" : "");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [minStock, setMinStock] = useState("5");
  // A photo handed over from the Scan screen: reuse it instead of asking for a retake.
  const [scanPhoto] = useState(() => (editing ? null : takePendingPhoto()));
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(scanPhoto?.uri ?? null);
  const [base64, setBase64] = useState<string | null>(scanPhoto?.base64 ?? null);
  const [uploading, setUploading] = useState(!!scanPhoto);
  const [identifying, setIdentifying] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [match, setMatch] = useState<any>(null);

  useEffect(() => {
    if (!scanPhoto) return;
    uploadImage(scanPhoto.base64)
      .then(setPhotoPath)
      .catch((e: any) => toast.show(e.message || "Photo upload failed", "error"))
      .finally(() => setUploading(false));
    // runs once for the handed-over photo; toast identity is irrelevant here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanPhoto]);

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
    uploadPhoto(outcome.result.base64);
    if (!editing) identify(outcome.result.base64);
  }

  async function uploadPhoto(b64: string) {
    setUploading(true);
    try {
      setPhotoPath(await uploadImage(b64));
    } catch (e: any) {
      toast.show(e.message || "Photo upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  // Fills only empty fields, so anything the user typed is kept.
  async function identify(b64: string | null = base64) {
    if (!b64) return;
    setIdentifying(true);
    try {
      const r = await apiPost("/ai/identify-plant", { image_base64: b64 });
      const known = r.plant_name && r.plant_name !== "Unknown Plant";
      if (known) setName((prev) => prev.trim() || r.plant_name);
      if (r.scientific_name) setBotanical((prev) => prev.trim() || r.scientific_name);
      if (r.suggested_category) setCategory((prev) => prev || r.suggested_category);
      setMatch(r.matched_product ?? null);
      toast.show(known ? `Identified: ${r.plant_name} (${r.confidence}%)` : "Could not recognise this plant", known ? "success" : "info");
    } catch (e: any) {
      toast.show(e.message || "Could not identify", "error");
    } finally {
      setIdentifying(false);
    }
  }

  function toCartItem(p: any, quantity = 1) {
    return {
      product_id: p.id,
      name: p.name,
      price: p.selling_price,
      quantity,
      photo_path: p.photo_path,
      botanical_name: p.botanical_name,
      stock: p.stock,
    };
  }

  // Back to the bill (closes the Scan modal and this screen) after adding a plant to it.
  function backToBill(p: any) {
    addItem(toCartItem(p));
    toast.show(`${p.name} added to bill`, "success");
    if (router.canDismiss()) router.dismissAll();
    router.navigate("/(tabs)/billing");
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
    onSuccess: (product) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (editing) qc.invalidateQueries({ queryKey: ["product", params.id] });
      if (selling) return backToBill(product);
      toast.show(editing ? "Product updated" : "Product added", "success");
      router.back();
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={editing ? "Edit Product" : selling ? "New Plant for Bill" : "Add Inventory"} />
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
          <Button title={identifying ? "Identifying…" : "Identify again"} icon="creation" variant="outline" size="md" onPress={() => identify()} loading={identifying} testID="product-identify" />
        )}

        {match && !editing && (
          <View style={s.matchCard} testID="product-already-in-stock">
            <Text style={s.matchTitle}>Already in stock</Text>
            <Text style={s.matchName}>
              {match.name} · {formatCurrency(match.selling_price)} · {match.stock} left
            </Text>
            {selling ? (
              <Button title="Add this to bill" icon="cart-plus" size="md" onPress={() => backToBill(match)} testID="product-match-add-to-bill" />
            ) : (
              <Button title="Open product" icon="arrow-right" size="md" variant="secondary" onPress={() => router.replace(`/product/${match.id}`)} testID="product-match-open" />
            )}
          </View>
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
          title={editing ? "Save Changes" : selling ? "Save & Add to Bill" : "Save Inventory"}
          icon={selling ? "cart-plus" : "content-save"}
          onPress={() => save.mutate()}
          disabled={!name.trim() || uploading || (selling && !(Number(price) > 0 && Number(stock) > 0))}
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
  matchCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm, borderWidth: 1.5, borderColor: colors.warning },
  matchTitle: { fontSize: 13, fontWeight: "800", color: colors.warning, textTransform: "uppercase" },
  matchName: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
}));
