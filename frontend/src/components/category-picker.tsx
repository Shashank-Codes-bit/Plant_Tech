// Category of a product: a select field that opens a list (with each category's GST % when the shop is
// GST registered). "New category" adds one on the spot (GST 0%; the owner can change it in Categories).
import { useState } from "react";
import { View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet, apiPost } from "@/src/api";
import { useAuth } from "@/src/auth";
import { OptionRow, SelectField, Sheet } from "@/src/components/sheet";
import { useToast } from "@/src/components/toast";
import { Button, Field, T } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";
import type { Category } from "@/src/types";

export function useCategories() {
  return useQuery<Category[]>({ queryKey: ["categories"], queryFn: () => apiGet("/categories") });
}

export function CategoryPicker({ value, onChange, label }: { value: string | null; onChange: (id: string | null) => void; label?: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const cats = useCategories();
  const gst = !!user?.business?.gst_registered;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = cats.data?.find((c) => c.id === value);

  async function add() {
    setBusy(true);
    try {
      const c: Category = await apiPost("/categories", { name: name.trim(), gst_percent: 0 });
      await qc.invalidateQueries({ queryKey: ["categories"] });
      onChange(c.id);
      setName("");
      setOpen(false);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SelectField label={label ?? t("Category")} value={chosen?.name} placeholder={t("Choose a category")} onPress={() => setOpen(true)}
        testID="category-select"
        right={chosen && gst ? <T v="bold" color={colors.inkSoft}>{t("{{n}}% GST", { n: chosen.gst_percent })}</T> : undefined} />
      <Sheet visible={open} onClose={() => setOpen(false)} title={t("Category")}>
        {(cats.data ?? []).map((c) => (
          <OptionRow key={c.id} label={c.name} sub={gst ? t("{{n}}% GST", { n: c.gst_percent }) : undefined} selected={value === c.id}
            onPress={() => { onChange(c.id); setOpen(false); }} testID={`cat-${c.name}`} />
        ))}
        <View style={{ gap: spacing.sm, marginTop: 6, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.line }}>
          <T v="label">{t("New category")}</T>
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" }}>
            <Field style={{ flex: 1 }} value={name} onChangeText={setName} placeholder={t("e.g. Seeds")} autoCapitalize="words" testID="cat-new-name" />
            <Button title={t("Add")} icon="plus" size="md" onPress={add} loading={busy} disabled={!name.trim()} testID="cat-new-add" />
          </View>
        </View>
      </Sheet>
    </>
  );
}
