// Add product: type a name → your own match ("add stock"), a shared-library match (picture + category),
// or create new. Or take a photo and the AI fills in the name and category.
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet, apiPost, uploadImage } from "@/src/api";
import { useCategories } from "@/src/components/category-picker";
import { emptyProduct, ProductForm, ProductValues } from "@/src/components/product-form";
import { useToast } from "@/src/components/toast";
import { Button, Field, Header, Icon, Screen, T, Thumb } from "@/src/components/ui";
import { formatQty } from "@/src/format";
import { takePhoto } from "@/src/hooks/useImageCapture";
import { colors, radius, spacing } from "@/src/theme";
import type { LibraryEntry, Product } from "@/src/types";

export default function NewProduct() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ name?: string }>();
  const cats = useCategories();
  const [q, setQ] = useState(params.name ?? "");
  const [form, setForm] = useState<ProductValues | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const query = q.trim();
  const sug = useQuery<{ own: Product[]; library: LibraryEntry[] }>({
    queryKey: ["suggest", query],
    queryFn: () => apiGet(`/products/suggest?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2 && !form,
  });

  const catIdByName = (name?: string) =>
    (cats.data ?? []).find((c) => c.name.toLowerCase() === (name ?? "").toLowerCase())?.id ?? null;

  function fromLibrary(e: LibraryEntry) {
    setForm({ ...emptyProduct, name: e.name, botanical_name: e.botanical, library_id: e.id, library_image: e.image_path,
      category_id: catIdByName(e.default_category) });
  }

  async function scan() {
    const out = await takePhoto();
    if (out.status === "denied") toast.show(t("Allow camera and photos for NurseryPOS in your phone settings"), "error");
    if (out.status !== "ok") return;
    setScanning(true);
    try {
      const [path, r] = await Promise.all([uploadImage(out.result.base64), apiPost("/ai/identify-plant", { image_base64: out.result.base64 })]);
      if (r.matched_product) {
        toast.show(t("You already have {{name}}. Add stock here.", { name: r.matched_product.name }), "info");
        router.replace({ pathname: "/products/[id]", params: { id: r.matched_product.id } });
        return;
      }
      setForm({ ...emptyProduct, name: r.plant_name === "Unknown Plant" ? "" : r.plant_name, botanical_name: r.scientific_name || "",
        category_id: r.suggested_category_id ?? null, photo_path: path });
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setScanning(false);
    }
  }

  async function save(body: Record<string, unknown>) {
    setSaving(true);
    try {
      const p: Product = await apiPost("/products", body);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.show(t("Saved {{name}}", { name: p.name }), "success");
      router.back();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (form) {
    return (
      <Screen>
        <Header title={t("New product")} onBack={() => setForm(null)} />
        <ProductForm initial={form} isNew onSave={save} saving={saving} />
      </Screen>
    );
  }

  const own = sug.data?.own ?? [];
  const lib = sug.data?.library ?? [];
  return (
    <Screen bg={colors.surface}>
      <Header title={t("Add product")} close />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: 14 }}>
        <Field label={t("Type the product name")} value={q} onChangeText={setQ} autoFocus autoCapitalize="words"
          placeholder={t("e.g. Money Plant, Clay pot")} testID="add-search" inputStyle={{ fontSize: 22 }} />

        {query.length >= 2 && sug.isLoading && <ActivityIndicator color={colors.green} />}

        {own.length > 0 && (
          <View style={{ gap: 8 }}>
            <T v="label">{t("Already yours")}</T>
            {own.map((p) => (
              <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.lg, backgroundColor: colors.page }}>
                <Thumb path={p.image_path} size={52} />
                <View style={{ flex: 1 }}>
                  <T v="bold">{p.name}</T>
                  <T v="small" color={p.low_stock ? colors.amber : colors.muted}>
                    {p.out_of_stock ? t("Out of stock") : p.low_stock ? t("Only {{n}} left", { n: formatQty(p.stock) }) : t("{{n}} in stock", { n: formatQty(p.stock) })}
                  </T>
                </View>
                <Button title={t("Add stock")} size="md" variant="secondary"
                  onPress={() => router.replace({ pathname: "/products/[id]", params: { id: p.id } })} testID={`add-own-${p.name}`} />
              </View>
            ))}
          </View>
        )}

        {lib.length > 0 && (
          <View style={{ gap: 8 }}>
            <T v="label">{t("From the shared picture library")}</T>
            {lib.map((e) => (
              <Pressable key={e.id} onPress={() => fromLibrary(e)} testID={`add-lib-${e.name}`}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, minHeight: 72, borderRadius: radius.lg,
                  borderWidth: 2, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}>
                <Thumb path={e.image_path} size={52} />
                <View style={{ flex: 1 }}>
                  <T v="bold">{e.name}{e.name_hi ? `  ·  ${e.name_hi}` : ""}</T>
                  <T v="small">{e.default_category}</T>
                </View>
                <Icon name="chevron-right" size={26} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        )}

        {query.length >= 2 && sug.data && (
          <Pressable onPress={() => setForm({ ...emptyProduct, name: query })} testID="add-create-new"
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, minHeight: 72, borderRadius: radius.lg, borderWidth: 2,
              borderStyle: "dashed", borderColor: colors.green }}>
            <Icon name="plus-circle" size={32} color={colors.green} />
            <View style={{ flex: 1 }}>
              <T v="bold" color={colors.greenDark}>{t("Create new “{{q}}”", { q: query })}</T>
              <T v="small">{t("Any product: plant, pot, soil, tool")}</T>
            </View>
          </Pressable>
        )}

        <View style={{ height: 8 }} />
        <Button title={scanning ? t("Finding the plant…") : t("Or take a photo, AI fills it in")} icon="camera" variant="scan"
          onPress={scan} loading={scanning} testID="add-scan" />
      </ScrollView>
    </Screen>
  );
}
