// Pick a product's category; shows each category's GST % when the shop is GST registered.
// "New category" adds one on the spot (GST 0%; the owner can change it in Categories).
import { useState } from "react";
import { Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet, apiPost } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { Button, Chip, Field, T } from "@/src/components/ui";
import { colors, fonts } from "@/src/theme";
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
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const c: Category = await apiPost("/categories", { name: name.trim(), gst_percent: 0 });
      await qc.invalidateQueries({ queryKey: ["categories"] });
      onChange(c.id);
      setAdding(false);
      setName("");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <T v="label">{label ?? t("Category")}</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(cats.data ?? []).map((c) => (
          <Chip key={c.id} label={c.name} active={value === c.id} testID={`cat-${c.name}`}
            onPress={() => onChange(value === c.id ? null : c.id)}
            right={gst ? (
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: value === c.id ? colors.white : colors.muted }}>{c.gst_percent}%</Text>
            ) : undefined} />
        ))}
        {!adding && <Chip label={t("+ New category")} onPress={() => setAdding(true)} testID="cat-new" />}
      </View>
      {adding && (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
          <Field style={{ flex: 1 }} value={name} onChangeText={setName} placeholder={t("e.g. Seeds")} autoFocus autoCapitalize="words" />
          <Button title={t("Add")} size="md" onPress={add} loading={busy} disabled={!name.trim()} />
        </View>
      )}
    </View>
  );
}
