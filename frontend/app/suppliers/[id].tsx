// A supplier: contact details, what the shop has bought from them, and each bill with its page photos.
import { useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiDelete, apiGet, fileUrl } from "@/src/api";
import { useAuth } from "@/src/auth";
import { confirm } from "@/src/confirm";
import { Sheet } from "@/src/components/sheet";
import { SupplierForm } from "@/src/components/supplier-form";
import { useToast } from "@/src/components/toast";
import { Button, ErrorView, Header, LoadingView, Screen, T } from "@/src/components/ui";
import { formatCurrency, formatDate, formatPhone, formatQty, plural } from "@/src/format";
import { colors, radius, spacing } from "@/src/theme";
import type { Purchase, Supplier } from "@/src/types";

export default function SupplierDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery<Supplier & { purchases: Purchase[] }>({ queryKey: ["supplier", id], queryFn: () => apiGet(`/suppliers/${id}`) });
  const [editing, setEditing] = useState(false);
  const [bill, setBill] = useState<Purchase | null>(null);
  const s = q.data;
  const digits = (s?.phone ?? "").replace(/\D/g, "");
  const wa = digits.length === 10 ? `91${digits}` : digits;

  async function remove() {
    if (!s || !(await confirm(t("Delete {{name}}?", { name: s.name }), t("Suppliers with bills cannot be deleted."), t("Delete"), true))) return;
    try {
      await apiDelete(`/suppliers/${s.id}`);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.show(t("Deleted"), "success");
      router.back();
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  }

  return (
    <Screen bg={colors.surface}>
      <Header title={t("Supplier")} right={isOwner && s ? <Button title={t("Edit")} icon="pencil" variant="outline" size="md" onPress={() => setEditing(true)} testID="supplier-edit" /> : undefined} />
      {!s ? (q.isError ? <ErrorView message={(q.error as Error).message} onRetry={q.refetch} /> : <LoadingView />) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <T v="title">{s.name}</T>
            {!!s.phone && <T v="body" color={colors.inkSoft}>{formatPhone(s.phone)}</T>}
            {!!s.gstin && <T v="small">{t("GSTIN {{gstin}}", { gstin: s.gstin })}</T>}
            {!!s.address && <T v="small">{s.address}</T>}
            {!!s.notes && <T v="small" color={colors.inkSoft}>{s.notes}</T>}
          </View>
          {digits.length >= 6 && (
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Button title={t("Call")} icon="phone" variant="outline" size="md" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${s.phone}`)} />
              {digits.length >= 10 && (
                <Button title={t("WhatsApp")} icon="whatsapp" variant="whatsapp" size="md" style={{ flex: 1 }}
                  onPress={() => Linking.openURL(`https://wa.me/${wa}`)} />
              )}
            </View>
          )}
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.page }}>
              <T v="label">{t("Total bought")}</T>
              <T v="title">{formatCurrency(s.total)}</T>
            </View>
            <View style={{ flex: 1, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.page }}>
              <T v="label">{t("Bills")}</T>
              <T v="title">{s.bills}</T>
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <T v="label" style={{ fontSize: 18 }}>{t("Supplier bills")}</T>
            {s.purchases.length ? s.purchases.map((b) => (
              <Pressable key={b.id} onPress={() => setBill(b)} testID={`supplier-bill-${b.invoice_number}`}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, minHeight: 68, borderRadius: radius.lg,
                  borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="bold">{[b.invoice_number && t("Bill {{no}}", { no: b.invoice_number }), formatDate(b.created_at)].filter(Boolean).join(" · ")}</T>
                  <T v="small">{[plural(b.items.length, "1 item", "{{n}} items"), b.image_paths.length ? plural(b.image_paths.length, "1 page", "{{n}} pages") : ""].filter(Boolean).join(" · ")}</T>
                </View>
                <T v="number">{formatCurrency(b.total)}</T>
              </Pressable>
            )) : <T v="small">{t("No bills yet")}</T>}
          </View>
          {isOwner && !s.bills && <Button title={t("Delete supplier")} icon="trash-can-outline" variant="danger" size="md" onPress={remove} />}
        </ScrollView>
      )}
      {s && <SupplierForm visible={editing} onClose={() => setEditing(false)} supplier={s} />}
      <Sheet visible={!!bill} onClose={() => setBill(null)} title={bill?.invoice_number ? t("Bill {{no}}", { no: bill.invoice_number }) : t("Supplier bill")}>
        {bill && (
          <>
            {!!bill.image_paths.length && (
              <ScrollView horizontal contentContainerStyle={{ gap: spacing.md }}>
                {bill.image_paths.map((p) => (
                  <Pressable key={p} onPress={() => Linking.openURL(fileUrl(p)!)} accessibilityLabel={t("Open page photo")}>
                    <Image source={{ uri: fileUrl(p) }} style={{ width: 120, height: 160, borderRadius: radius.md, backgroundColor: colors.page }} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {bill.items.map((it, i) => (
              <View key={i} style={{ flexDirection: "row", gap: spacing.md, paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.line }}>
                <T v="body" style={{ flex: 1 }}>{it.name}</T>
                <T v="small">{formatQty(it.quantity)} × {formatCurrency(it.purchase_price)}</T>
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: spacing.xs }}>
              <T v="bold">{t("Total")}</T>
              <T v="bold">{formatCurrency(bill.total)}</T>
            </View>
          </>
        )}
      </Sheet>
    </Screen>
  );
}
