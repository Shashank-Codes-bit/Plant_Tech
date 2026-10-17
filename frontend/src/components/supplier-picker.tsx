// Choosing the supplier of a supplier bill: a saved one, or a new name (saved with the bill; the server
// matches it to an existing supplier when the name, phone or GSTIN is the same, so none is duplicated).
import { useState } from "react";
import { ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet } from "@/src/api";
import { OptionRow, Sheet } from "@/src/components/sheet";
import { SearchBox, T } from "@/src/components/ui";
import { formatPhone } from "@/src/format";
import { colors } from "@/src/theme";
import type { Supplier } from "@/src/types";

export type SupplierChoice = { id: string | null; name: string; phone: string; address: string; gstin: string };

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, " ").trim();

export function SupplierPicker({ visible, onClose, onPick, selectedId }: {
  visible: boolean; onClose: () => void; onPick: (s: SupplierChoice) => void; selectedId?: string | null;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const list = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => apiGet("/suppliers"), enabled: visible });
  const query = key(q);
  const shown = (list.data ?? []).filter((s) => !query || key(s.name).includes(query) || s.phone.replace(/\D/g, "").includes(query.replace(/\D/g, "") || "~"));
  const exact = (list.data ?? []).some((s) => key(s.name) === query);

  const pick = (s: SupplierChoice) => {
    onPick(s);
    setQ("");
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t("Supplier")} testID="supplier-picker">
      <SearchBox value={q} onChangeText={setQ} placeholder={t("Search or type a new supplier")} autoCapitalize="words"
        testID="supplier-search" />
      {!!query && !exact && (
        <OptionRow icon="plus-circle-outline" label={t("Add “{{name}}” as a new supplier", { name: q.trim() })}
          sub={t("Saved with this bill")} onPress={() => pick({ id: null, name: q.trim(), phone: "", address: "", gstin: "" })}
          testID="supplier-new" />
      )}
      {list.isLoading && <ActivityIndicator color={colors.green} />}
      {shown.map((s) => (
        <OptionRow key={s.id} label={s.name} sub={[formatPhone(s.phone), s.gstin].filter(Boolean).join(" · ") || undefined}
          selected={s.id === selectedId} onPress={() => pick({ id: s.id, name: s.name, phone: s.phone, address: s.address, gstin: s.gstin })}
          testID={`supplier-${s.name}`} />
      ))}
      {list.data && !list.data.length && !query && <T v="small">{t("No suppliers yet. Type a name to add one.")}</T>}
    </Sheet>
  );
}
