// Product details form, used by Add product and Edit product.
// Picture: the shop's own photo wins; otherwise the shared library picture is shown.
import { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTranslation } from "react-i18next";

import { uploadImage } from "@/src/api";
import { useAuth } from "@/src/auth";
import { CategoryPicker } from "@/src/components/category-picker";
import { useToast } from "@/src/components/toast";
import { BottomBar, Button, Field, T, Thumb } from "@/src/components/ui";
import { pickFromGallery, takePhoto } from "@/src/hooks/useImageCapture";
import { colors, radius, spacing } from "@/src/theme";

export type ProductValues = {
  name: string; botanical_name: string; category_id: string | null; library_id: string | null;
  photo_path: string | null; library_image: string | null;
  selling_price: string; stock: string; cost_price: string; min_stock: string;
};

export const emptyProduct: ProductValues = {
  name: "", botanical_name: "", category_id: null, library_id: null, photo_path: null, library_image: null,
  selling_price: "", stock: "", cost_price: "", min_stock: "5",
};

const num = (v: string) => v.replace(/[^0-9.]/g, "");

export function ProductForm({ initial, isNew, onSave, saving, extra }: {
  initial: ProductValues; isNew: boolean; saving: boolean; extra?: React.ReactNode;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { isOwner, user } = useAuth();
  const [v, setV] = useState<ProductValues>(initial);
  const [uploading, setUploading] = useState(false);
  const set = (patch: Partial<ProductValues>) => setV((o) => ({ ...o, ...patch }));
  const gst = !!user?.business?.gst_registered;

  async function photo(source: "camera" | "gallery") {
    const out = source === "camera" ? await takePhoto() : await pickFromGallery();
    if (out.status === "denied") toast.show(t("Allow camera and photos for NurseryPOS in your phone settings"), "error");
    if (out.status !== "ok") return;
    setUploading(true);
    try {
      set({ photo_path: await uploadImage(out.result.base64) });
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setUploading(false);
    }
  }

  const picture = v.photo_path || v.library_image;
  const note = v.photo_path ? t("Your own photo") : v.library_image ? t("Shared picture. Add your own photo to use it instead.") : t("No picture yet");
  const ok = !!v.name.trim() && v.selling_price !== "" && !uploading;

  function save() {
    const body: Record<string, unknown> = {
      name: v.name.trim(), botanical_name: v.botanical_name, category_id: v.category_id, photo_path: v.photo_path,
      selling_price: Number(v.selling_price) || 0, min_stock: Number(v.min_stock) || 0,
    };
    if (isOwner && v.cost_price !== "") body.cost_price = Number(v.cost_price) || 0;
    if (isNew) {
      body.stock = Number(v.stock) || 0;
      body.library_id = v.library_id;
    }
    onSave(body);
  }

  return (
    <>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: 16 }} bottomOffset={24} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <Thumb path={picture} size={96} />
          <View style={{ flex: 1, gap: 8 }}>
            <T v="small">{uploading ? t("Uploading…") : note}</T>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title={t("Photo")} icon="camera" variant="outline" size="md" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => photo("camera")} />
              <Button title={t("Gallery")} icon="image-outline" variant="outline" size="md" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => photo("gallery")} />
            </View>
          </View>
        </View>

        <Field label={t("Product name")} value={v.name} onChangeText={(name) => set({ name })} autoCapitalize="words" testID="product-name" />
        <CategoryPicker value={v.category_id} onChange={(category_id) => set({ category_id })} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field style={{ flex: 1 }} label={gst ? t("Price ₹ (incl. GST)") : t("Price ₹")} value={v.selling_price} keyboardType="decimal-pad"
            onChangeText={(x) => set({ selling_price: num(x) })} placeholder="0" testID="product-price" inputStyle={{ fontSize: 24 }} />
          {isNew && (
            <Field style={{ flex: 1 }} label={t("How many now")} value={v.stock} keyboardType="decimal-pad"
              onChangeText={(x) => set({ stock: num(x) })} placeholder="0" testID="product-stock" inputStyle={{ fontSize: 24 }} />
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {isOwner && (
            <Field style={{ flex: 1 }} label={t("Cost price ₹")} hint={t("Only the owner sees this")} value={v.cost_price} keyboardType="decimal-pad"
              onChangeText={(x) => set({ cost_price: num(x) })} placeholder="0" testID="product-cost" />
          )}
          <Field style={{ flex: 1 }} label={t("Warn me below")} hint={t("Low stock alert")} value={v.min_stock} keyboardType="decimal-pad"
            onChangeText={(x) => set({ min_stock: num(x) })} testID="product-min" />
        </View>
        {extra}
      </KeyboardAwareScrollView>
      <BottomBar>
        <Button title={t("Save product")} icon="content-save" onPress={save} loading={saving} disabled={!ok} testID="product-save" />
      </BottomBar>
    </>
  );
}

// Big tappable row used in Add product suggestions.
export function SuggestBox({ children }: { children: React.ReactNode }) {
  return <View style={{ gap: 8, padding: 12, borderRadius: radius.lg, backgroundColor: colors.page }}>{children}</View>;
}
