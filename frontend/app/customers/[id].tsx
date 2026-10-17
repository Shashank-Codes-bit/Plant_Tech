// A customer: call or WhatsApp them, what they've bought.
import { Linking, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet } from "@/src/api";
import { Button, ErrorView, Header, LoadingView, Screen, T } from "@/src/components/ui";
import { formatCurrency, formatDate, formatPhone, formatQty } from "@/src/format";
import { colors, radius, spacing } from "@/src/theme";
import type { Customer } from "@/src/types";

type PastBill = { id: string; invoice_number: string; grand_total: number; created_at: string; items: { name: string; quantity: number }[] };

export default function CustomerDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery<Customer & { invoices: PastBill[] }>({ queryKey: ["customer", id], queryFn: () => apiGet(`/customers/${id}`) });
  const c = q.data;
  const digits = c?.phone.replace(/\D/g, "") ?? "";

  return (
    <Screen bg={colors.surface}>
      <Header title={t("Customer")} />
      {!c ? (q.isError ? <ErrorView message={(q.error as Error).message} onRetry={q.refetch} /> : <LoadingView />) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          <View style={{ alignItems: "center", gap: spacing.xs }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center" }}>
              <T v="heading" color={colors.greenDark}>{c.name.charAt(0).toUpperCase()}</T>
            </View>
            <T v="title">{c.name}</T>
            {!!c.phone && <T v="body" color={colors.inkSoft}>{formatPhone(c.phone)}</T>}
          </View>
          {!!c.phone && (
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Button title={t("Call")} icon="phone" variant="outline" size="md" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${c.phone}`)} />
              <Button title={t("WhatsApp")} icon="whatsapp" variant="whatsapp" size="md" style={{ flex: 1 }}
                onPress={() => Linking.openURL(`https://wa.me/${digits}`)} />
            </View>
          )}
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.page }}>
              <T v="label">{t("Total bought")}</T>
              <T v="title">{formatCurrency(c.total_purchases)}</T>
            </View>
            <View style={{ flex: 1, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.page }}>
              <T v="label">{t("Visits")}</T>
              <T v="title">{c.purchase_count}</T>
            </View>
          </View>
          {!!c.address && <T v="body" color={colors.inkSoft}>{c.address}</T>}
          {!!c.notes && <T v="small">{c.notes}</T>}

          <View style={{ gap: spacing.sm }}>
            <T v="label" style={{ fontSize: 18 }}>{t("Past bills")}</T>
            {c.invoices.length ? c.invoices.map((b) => (
              <Pressable key={b.id} onPress={() => router.push({ pathname: "/bill/[id]", params: { id: b.id } })}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, minHeight: 68, borderRadius: radius.lg,
                  borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="bold">{formatDate(b.created_at)}</T>
                  <T v="small">
                    {b.items.map((i) => (i.quantity > 1 ? `${i.name} × ${formatQty(i.quantity)}` : i.name)).join(", ")}
                  </T>
                </View>
                <T v="number">{formatCurrency(b.grand_total)}</T>
              </Pressable>
            )) : <T v="small">{t("No bills yet")}</T>}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
