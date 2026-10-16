import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { apiPost, fileUrl } from "@/src/api";
import { formatCurrency } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, Field, Icon, Stepper } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { useCart } from "@/src/cart-context";
import { pickFromGallery, takePhoto } from "@/src/hooks/useImageCapture";
import { setPendingPhoto } from "@/src/pending-photo";

const SCANNER_IMG =
  "https://images.pexels.com/photos/36163263/pexels-photo-36163263.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

type Stage = "idle" | "analyzing" | "result" | "error" | "added";

export default function Scan() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { addItem } = useCart();

  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<any>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoB64, setPhotoB64] = useState<string | null>(null);
  // "Bill without stock": a one-off cart line for something the nursery doesn't track.
  const [looseOpen, setLooseOpen] = useState(false);
  const [looseName, setLooseName] = useState("");
  const [loosePrice, setLoosePrice] = useState("");
  const [qty, setQty] = useState(1);
  const [permDenied, setPermDenied] = useState(false);

  async function capture(source: "camera" | "gallery") {
    setPermDenied(false);
    const outcome = source === "camera" ? await takePhoto() : await pickFromGallery();
    if (outcome.status === "denied") {
      setPermDenied(true);
      return;
    }
    if (outcome.status !== "ok") return;
    setPhotoUri(outcome.result.uri);
    setPhotoB64(outcome.result.base64);
    setLooseOpen(false);
    setLoosePrice("");
    setStage("analyzing");
    setQty(1);
    try {
      const data = await apiPost("/ai/identify-plant", { image_base64: outcome.result.base64 });
      setResult(data);
      setStage("result");
    } catch (e: any) {
      toast.show(e.message || "Could not identify plant", "error");
      setStage("error");
    }
  }

  function addToCart() {
    const p = result?.matched_product;
    if (!p) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    addItem({
      product_id: p.id,
      name: p.name,
      price: p.selling_price,
      quantity: qty,
      photo_path: p.photo_path,
      botanical_name: p.botanical_name,
      stock: p.stock,
    });
    setStage("added");
  }

  const knownName = result?.plant_name && result.plant_name !== "Unknown Plant" ? result.plant_name : "";

  // Not in stock: stay in the bill. The new-plant form gets this photo, so no retake.
  function addAsNew() {
    setPendingPhoto(photoUri && photoB64 ? { uri: photoUri, base64: photoB64 } : null);
    router.push({
      pathname: "/product/new",
      params: {
        name: knownName,
        botanical: result?.scientific_name ?? "",
        category: result?.suggested_category ?? "",
        mode: "sell",
      },
    });
  }

  function openLoose() {
    setLooseName(knownName);
    setLooseOpen(true);
  }

  function addLoose() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    addItem({
      product_id: `loose-${Date.now().toString(36)}`,
      name: looseName.trim(),
      price: Number(loosePrice),
      quantity: qty,
    });
    setStage("added");
  }

  const matched = result?.matched_product;
  const confLabel = result?.confidence_label;
  const confColor =
    confLabel === "High" ? colors.success : confLabel === "Medium" ? colors.warning : colors.error;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={s.topTitle}>Scan Plant</Text>
        <Pressable testID="scan-close" onPress={() => router.back()} hitSlop={10} style={s.closeBtn}>
          <Icon name="close" size={26} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        {/* Preview */}
        <View style={s.preview}>
          <Image
            source={{ uri: photoUri || SCANNER_IMG }}
            style={s.previewImg}
            contentFit="cover"
          />
          {stage === "analyzing" && (
            <View style={s.overlay}>
              <Icon name="leaf" size={40} color="#FFFFFF" />
              <Text style={s.overlayText}>Analyzing leaf…</Text>
            </View>
          )}
        </View>

        {stage === "idle" && (
          <View style={{ gap: spacing.md }}>
            <Text style={s.hint}>Point at a plant and take a photo. AI will find the product for you.</Text>
            {permDenied && (
              <View style={s.permCard}>
                <Text style={s.permText}>Camera access is needed to scan plants.</Text>
                <Button title="Open Settings" variant="outline" size="md" icon="cog" onPress={() => Linking.openSettings()} testID="scan-open-settings" />
              </View>
            )}
            <Button title="Take Photo" icon="camera" onPress={() => capture("camera")} testID="scan-take-photo" />
            <Button title="Choose from Gallery" icon="image" variant="secondary" onPress={() => capture("gallery")} testID="scan-gallery" />
          </View>
        )}

        {stage === "analyzing" && (
          <Text style={[s.hint, { textAlign: "center" }]}>Identifying your plant…</Text>
        )}

        {stage === "error" && (
          <View style={{ gap: spacing.md }}>
            <Text style={[s.hint, { textAlign: "center" }]}>We couldn&apos;t identify that. Try again or search manually.</Text>
            <Button title="Retake Photo" icon="camera-retake" onPress={() => capture("camera")} testID="scan-retry" />
            <Button title="Search Products" icon="magnify" variant="secondary" onPress={() => router.push("/search")} testID="scan-error-search" />
          </View>
        )}

        {stage === "result" && result && (
          <View style={{ gap: spacing.md }}>
            <View style={s.resultCard}>
              <Text style={s.weThink}>We think this is</Text>
              <Text style={s.plantName}>{result.plant_name}</Text>
              {!!result.scientific_name && <Text style={s.sciName}>{result.scientific_name}</Text>}
              <View style={[s.confPill, { backgroundColor: confColor }]}>
                <Icon name="check-decagram" size={16} color="#FFFFFF" />
                <Text style={s.confText}>
                  {confLabel} · {result.confidence}%
                </Text>
              </View>
              {result.alternatives?.length > 0 && (
                <Text style={s.alt}>Could also be: {result.alternatives.join(", ")}</Text>
              )}
            </View>

            {matched ? (
              <View style={s.matchCard}>
                <View style={s.matchTop}>
                  <View style={s.matchThumb}>
                    {matched.photo_path ? (
                      <Image source={{ uri: fileUrl(matched.photo_path) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : (
                      <Icon name="leaf" size={28} color={colors.brandPrimary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.matchLabel}>Matched Product</Text>
                    <Text style={s.matchName}>{matched.name}</Text>
                    <Text style={s.matchPrice}>{formatCurrency(matched.selling_price)}</Text>
                    <Text style={s.matchStock}>In stock: {matched.stock}</Text>
                  </View>
                </View>
                <View style={s.qtyRow}>
                  <Text style={s.qtyLabel}>Quantity</Text>
                  <Stepper value={qty} onChange={(v) => setQty(Math.max(1, v))} min={1} testID="scan-qty" />
                </View>
                <Button
                  title={`Add to Cart · ${formatCurrency(matched.selling_price * qty)}`}
                  icon="cart-plus"
                  onPress={addToCart}
                  disabled={matched.stock <= 0}
                  testID="scan-add-to-cart"
                />
              </View>
            ) : (
              <View style={s.matchCard}>
                <Text style={s.noMatch}>Not in your stock yet. You can still add it to this bill:</Text>
                <Button title="Add as New Plant" icon="plus-box" onPress={addAsNew} testID="scan-add-new" />
                <Button title="Bill Without Stock" icon="cash-plus" variant="secondary" onPress={openLoose} testID="scan-bill-loose" />
                {looseOpen && (
                  <View style={s.looseBox}>
                    <Field label="Item name" value={looseName} onChangeText={setLooseName} placeholder="e.g. Rose plant" testID="scan-loose-name" />
                    <Field label="Price ₹ (each)" value={loosePrice} onChangeText={setLoosePrice} keyboardType="numeric" placeholder="0" testID="scan-loose-price" />
                    <View style={s.qtyRow}>
                      <Text style={s.qtyLabel}>Quantity</Text>
                      <Stepper value={qty} onChange={(v) => setQty(Math.max(1, v))} min={1} testID="scan-loose-qty" />
                    </View>
                    <Button
                      title={`Add to Bill · ${formatCurrency((Number(loosePrice) || 0) * qty)}`}
                      icon="cart-plus"
                      onPress={addLoose}
                      disabled={!looseName.trim() || !(Number(loosePrice) > 0)}
                      testID="scan-loose-add"
                    />
                  </View>
                )}
                <Button title="Search My Products" icon="magnify" variant="outline" size="md" onPress={() => router.push("/search")} testID="scan-search-products" />
              </View>
            )}

            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Button title="Choose Different" variant="secondary" size="md" onPress={() => router.push("/search")} style={{ flex: 1 }} testID="scan-choose-different" />
              <Button title="Retake" icon="camera-retake" variant="outline" size="md" onPress={() => capture("camera")} style={{ flex: 1 }} testID="scan-retake" />
            </View>
          </View>
        )}

        {stage === "added" && (
          <View style={{ gap: spacing.md, alignItems: "center" }}>
            <View style={s.successCircle}>
              <Icon name="check" size={48} color={colors.onSuccess} />
            </View>
            <Text style={s.addedText}>Added to cart!</Text>
            <Button title="Scan Next Plant" icon="camera" onPress={() => { setStage("idle"); setPhotoUri(null); }} testID="scan-next" style={{ alignSelf: "stretch" }} />
            <Button title="Go to Cart" icon="cart" variant="secondary" onPress={() => router.replace("/(tabs)/billing")} testID="scan-go-cart" style={{ alignSelf: "stretch" }} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  topTitle: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  preview: {
    width: "100%",
    height: 240,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
    marginBottom: spacing.lg,
  },
  previewImg: { width: "100%", height: "100%" },
  overlay: {
    ...StyleSheetAbsolute(),
    backgroundColor: "rgba(11,18,12,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  overlayText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },

  hint: { fontSize: 16, color: colors.muted, lineHeight: 22 },

  permCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  permText: { fontSize: 16, color: colors.onSurface },

  resultCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  weThink: { fontSize: 15, color: colors.muted, fontWeight: "600" },
  plantName: { fontSize: 26, fontWeight: "800", color: colors.onSurface },
  sciName: { fontSize: 16, fontStyle: "italic", color: colors.muted },
  confPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: spacing.sm,
  },
  confText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  alt: { fontSize: 14, color: colors.muted, marginTop: spacing.sm },

  matchCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
    gap: spacing.md,
  },
  matchTop: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  matchThumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  matchLabel: { fontSize: 13, fontWeight: "700", color: colors.brandPrimary, textTransform: "uppercase" },
  matchName: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  matchPrice: { fontSize: 18, fontWeight: "800", color: colors.brandPrimary },
  matchStock: { fontSize: 14, color: colors.muted },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qtyLabel: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  noMatch: { fontSize: 16, color: colors.onSurface, marginBottom: spacing.sm },
  looseBox: { gap: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },

  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  addedText: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
}));

function StyleSheetAbsolute() {
  return { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
}
