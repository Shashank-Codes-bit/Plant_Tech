import { useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPost, uploadImage } from "@/src/api";
import { formatCurrency } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, Field, Icon } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { pickFromGallery, takePhoto } from "@/src/hooks/useImageCapture";

type Item = { name: string; quantity: string; purchase_price: string; product_id: string | null; matched_name: string | null };
type Stage = "idle" | "analyzing" | "review";

export default function ScanInvoice() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const [stage, setStage] = useState<Stage>("idle");
  const [supplier, setSupplier] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [permDenied, setPermDenied] = useState(false);

  async function capture(source: "camera" | "gallery") {
    setPermDenied(false);
    const outcome = source === "camera" ? await takePhoto() : await pickFromGallery();
    if (outcome.status === "denied") return setPermDenied(true);
    if (outcome.status !== "ok") return;
    setLocalUri(outcome.result.uri);
    setStage("analyzing");
    // The bill photo is kept for records only; reading the bill doesn't depend on it.
    uploadImage(outcome.result.base64)
      .then(setImagePath)
      .catch(() => toast.show("Bill photo not saved, items are still read", "info"));
    try {
      const r = await apiPost("/ai/scan-invoice", { image_base64: outcome.result.base64 });
      setSupplier(r.supplier || "");
      setInvoiceNo(r.invoice_number || "");
      setDate(r.date || "");
      setItems(
        (r.items || []).map((it: any) => ({
          name: it.name,
          quantity: String(it.quantity || ""),
          purchase_price: String(it.purchase_price || ""),
          product_id: it.product_id || null,
          matched_name: it.matched_name || null,
        })),
      );
      setStage("review");
    } catch (e: any) {
      toast.show(e.message || "Could not read invoice", "error");
      setStage("idle");
    }
  }

  function updateItem(idx: number, key: keyof Item, value: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const confirm = useMutation({
    mutationFn: () =>
      apiPost("/purchases", {
        supplier: supplier.trim(),
        invoice_number: invoiceNo.trim(),
        date: date.trim(),
        image_path: imagePath,
        total: items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.purchase_price) || 0), 0),
        items: items.map((it) => ({
          product_id: it.product_id,
          name: it.name.trim(),
          quantity: Number(it.quantity) || 0,
          purchase_price: Number(it.purchase_price) || 0,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.show("Inventory updated from invoice", "success");
      router.replace("/(tabs)/inventory");
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const total = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.purchase_price) || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={s.topTitle}>Scan Purchase Invoice</Text>
        <Pressable testID="scaninvoice-close" onPress={() => router.back()} hitSlop={10} style={s.closeBtn}>
          <Icon name="close" size={26} color={colors.onSurface} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 120, gap: spacing.md }}
        bottomOffset={20}
      >
        <View style={s.preview}>
          {localUri ? (
            <Image source={{ uri: localUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <Icon name="text-box-search" size={48} color={colors.brandPrimary} />
          )}
          {stage === "analyzing" && (
            <View style={s.overlay}>
              <Icon name="text-recognition" size={36} color="#FFFFFF" />
              <Text style={s.overlayText}>Reading invoice…</Text>
            </View>
          )}
        </View>

        {stage === "idle" && (
          <View style={{ gap: spacing.md }}>
            <Text style={s.hint}>Photograph a supplier bill. AI will pull out the items and quantities for you to confirm.</Text>
            {permDenied && (
              <View style={s.permCard}>
                <Text style={s.permText}>Camera access is needed.</Text>
                <Button title="Open Settings" variant="outline" size="md" icon="cog" onPress={() => Linking.openSettings()} testID="scaninvoice-settings" />
              </View>
            )}
            <Button title="Take Photo" icon="camera" onPress={() => capture("camera")} testID="scaninvoice-take-photo" />
            <Button title="Choose from Gallery" icon="image" variant="secondary" onPress={() => capture("gallery")} testID="scaninvoice-gallery" />
          </View>
        )}

        {stage === "review" && (
          <>
            <Field label="Supplier" placeholder="Supplier name" value={supplier} onChangeText={setSupplier} testID="scaninvoice-supplier" />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Field label="Invoice No." placeholder="INV-000" value={invoiceNo} onChangeText={setInvoiceNo} style={{ flex: 1 }} testID="scaninvoice-number" />
              <Field label="Date" placeholder="" value={date} onChangeText={setDate} style={{ flex: 1 }} testID="scaninvoice-date" />
            </View>

            <Text style={s.section}>Items ({items.length})</Text>
            {items.map((it, idx) => (
              <View key={idx} style={s.itemCard} testID={`scaninvoice-item-${idx}`}>
                <View style={s.itemHead}>
                  <TextInput
                    value={it.name}
                    onChangeText={(v) => updateItem(idx, "name", v)}
                    placeholder="Product name"
                    placeholderTextColor={colors.muted}
                    style={s.itemNameInput}
                    testID={`scaninvoice-item-name-${idx}`}
                  />
                  <Pressable onPress={() => removeItem(idx)} hitSlop={8} testID={`scaninvoice-item-remove-${idx}`}>
                    <Icon name="close-circle" size={24} color={colors.error} />
                  </Pressable>
                </View>
                {it.matched_name ? (
                  <Text style={s.matched}>✓ Matches: {it.matched_name}</Text>
                ) : (
                  <Text style={s.newItem}>+ New product</Text>
                )}
                <View style={{ flexDirection: "row", gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>Quantity</Text>
                    <TextInput value={it.quantity} onChangeText={(v) => updateItem(idx, "quantity", v)} keyboardType="numeric" style={s.miniInput} testID={`scaninvoice-item-qty-${idx}`} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>Cost ₹</Text>
                    <TextInput value={it.purchase_price} onChangeText={(v) => updateItem(idx, "purchase_price", v)} keyboardType="numeric" style={s.miniInput} testID={`scaninvoice-item-price-${idx}`} />
                  </View>
                </View>
              </View>
            ))}

            <Button title="Retake Photo" icon="camera-retake" variant="outline" size="md" onPress={() => setStage("idle")} testID="scaninvoice-retake" />
          </>
        )}
      </KeyboardAwareScrollView>

      {stage === "review" && (
        <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Purchase Total</Text>
            <Text style={s.totalValue}>{formatCurrency(total)}</Text>
          </View>
          <Button title="Add to Inventory" icon="database-plus" onPress={() => confirm.mutate()} loading={confirm.isPending} disabled={items.length === 0} testID="scaninvoice-confirm" />
        </View>
      )}
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
  topTitle: { fontSize: 20, fontWeight: "800", color: colors.onSurface, flex: 1 },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  preview: {
    width: "100%",
    height: 180,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const),
    backgroundColor: "rgba(11,18,12,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  overlayText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  hint: { fontSize: 16, color: colors.muted, lineHeight: 22 },
  permCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  permText: { fontSize: 16, color: colors.onSurface },

  section: { fontSize: 18, fontWeight: "800", color: colors.onSurface, marginTop: spacing.sm },
  itemCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  itemHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  itemNameInput: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.onSurface, paddingVertical: 6 },
  matched: { fontSize: 14, color: colors.success, fontWeight: "700" },
  newItem: { fontSize: 14, color: colors.warning, fontWeight: "700" },
  miniLabel: { fontSize: 13, color: colors.muted, fontWeight: "600", marginBottom: 4 },
  miniInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    minHeight: 48,
    fontSize: 17,
    fontWeight: "700",
    color: colors.onSurface,
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  totalValue: { fontSize: 24, fontWeight: "800", color: colors.brandPrimary },
}));
