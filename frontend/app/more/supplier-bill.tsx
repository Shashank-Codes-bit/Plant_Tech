// Supplier bill: photo of the bill → AI reads the items → check them → stock is added.
// Items that match a product add to its stock; the rest become new products.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTranslation } from "react-i18next";

import { apiPost, uploadImage } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { Badge, BottomBar, Button, Field, Header, Icon, Screen, T } from "@/src/components/ui";
import { formatCurrency } from "@/src/format";
import { pickFromGallery, takePhoto } from "@/src/hooks/useImageCapture";
import { colors, radius, spacing } from "@/src/theme";

type Item = { key: string; product_id: string | null; matched_name: string | null; name: string; quantity: string; purchase_price: string };
const num = (v: string) => v.replace(/[^0-9.]/g, "");

export default function SupplierBill() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [supplier, setSupplier] = useState("");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);

  async function read(source: "camera" | "gallery") {
    const out = source === "camera" ? await takePhoto() : await pickFromGallery();
    if (out.status === "denied") toast.show(t("Allow camera and photos for NurseryPOS in your phone settings"), "error");
    if (out.status !== "ok") return;
    setReading(true);
    try {
      const [path, r] = await Promise.all([uploadImage(out.result.base64), apiPost("/ai/scan-invoice", { image_base64: out.result.base64 })]);
      setImage(path);
      setSupplier(r.supplier || "");
      setNumber(r.invoice_number || "");
      setDate(r.date || "");
      setItems(r.items.map((it: any, i: number) => ({ key: `${i}`, product_id: it.product_id, matched_name: it.matched_name, name: it.name,
        quantity: String(it.quantity || 1), purchase_price: String(it.purchase_price || "") })));
      if (!r.items.length) toast.show(t("No items found on this bill. Add them below."), "info");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setReading(false);
    }
  }

  const set = (key: string, patch: Partial<Item>) => setItems((list) => list!.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const valid = (items ?? []).filter((i) => i.name.trim() && Number(i.quantity) > 0);
  const total = valid.reduce((s, i) => s + Number(i.quantity) * (Number(i.purchase_price) || 0), 0);

  async function save() {
    setSaving(true);
    try {
      await apiPost("/purchases", { supplier, invoice_number: number, date, image_path: image, total,
        items: valid.map((i) => ({ product_id: i.product_id, name: i.name.trim(), quantity: Number(i.quantity), purchase_price: Number(i.purchase_price) || 0 })) });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.show(t("Stock added for {{n}} items", { n: valid.length }), "success");
      router.back();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (!items) {
    return (
      <Screen bg={colors.surface}>
        <Header title={t("Supplier bill")} />
        <View style={{ flex: 1, padding: spacing.lg, gap: 14, justifyContent: "center" }}>
          <View style={{ alignItems: "center", gap: 10, marginBottom: 12 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.blueTint, alignItems: "center", justifyContent: "center" }}>
              <Icon name="file-document-outline" size={50} color={colors.blue} />
            </View>
            <T v="title" style={{ textAlign: "center" }}>{t("Photo of the supplier's bill")}</T>
            <T v="body" color={colors.inkSoft} style={{ textAlign: "center" }}>{t("AI reads the items. You check them, then the stock is added.")}</T>
          </View>
          <Button title={reading ? t("Reading the bill…") : t("Take photo")} icon="camera" variant="scan" onPress={() => read("camera")} loading={reading} testID="sb-camera" />
          <Button title={t("Pick from gallery")} icon="image-outline" variant="outline" size="md" onPress={() => read("gallery")} disabled={reading} />
          <Pressable onPress={() => setItems([{ key: "m0", product_id: null, matched_name: null, name: "", quantity: "1", purchase_price: "" }])}
            style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
            <T v="bold" color={colors.green}>{t("Type the items instead")}</T>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen bg={colors.surface}>
      <Header title={t("Check the items")} onBack={() => setItems(null)} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: 12 }} bottomOffset={24}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Field style={{ flex: 1.4 }} label={t("Supplier")} value={supplier} onChangeText={setSupplier} autoCapitalize="words" />
          <Field style={{ flex: 1 }} label={t("Bill no.")} value={number} onChangeText={setNumber} />
        </View>
        {items.map((it) => (
          <View key={it.key} style={{ gap: 8, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {it.product_id ? <Badge text={t("Adds to {{name}}", { name: it.matched_name })} tone="green" /> : <Badge text={t("New product")} tone="blue" />}
              <View style={{ flex: 1 }} />
              <Pressable accessibilityLabel={t("Remove")} onPress={() => setItems((l) => l!.filter((x) => x.key !== it.key))}
                style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Icon name="trash-can-outline" size={24} color={colors.red} />
              </Pressable>
            </View>
            <Field value={it.name} onChangeText={(name) => set(it.key, { name })}
              placeholder={t("Item name")} autoCapitalize="words" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Field style={{ flex: 1 }} label={t("How many")} value={it.quantity} onChangeText={(v) => set(it.key, { quantity: num(v) })} keyboardType="decimal-pad" />
              <Field style={{ flex: 1 }} label={t("Cost ₹ each")} value={it.purchase_price} onChangeText={(v) => set(it.key, { purchase_price: num(v) })} keyboardType="decimal-pad" />
            </View>
          </View>
        ))}
        <Button title={t("Add an item")} icon="plus" variant="dashed" size="md"
          onPress={() => setItems((l) => [...l!, { key: `m${Date.now()}`, product_id: null, matched_name: null, name: "", quantity: "1", purchase_price: "" }])} />
        <T v="small">{t("New products get a selling price of cost + 60%. Change it later in Products.")}</T>
      </KeyboardAwareScrollView>
      <BottomBar>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <T v="label">{t("{{n}} items", { n: valid.length })}</T>
          <T v="bold">{formatCurrency(total)}</T>
        </View>
        <Button title={t("Add to stock")} icon="package-variant-plus" onPress={save} loading={saving} disabled={!valid.length} testID="sb-save" />
      </BottomBar>
    </Screen>
  );
}
