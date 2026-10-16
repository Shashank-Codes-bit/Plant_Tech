// Sales: today / this week / this month, how customers paid, best sellers.
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet } from "@/src/api";
import { ErrorView, Header, LoadingView, Screen, Segmented, T } from "@/src/components/ui";
import { formatCurrency, formatQty } from "@/src/format";
import { colors, radius, spacing } from "@/src/theme";

type Range = "today" | "week" | "month";
type Report = {
  sales: number; orders: number; profit: number; buckets: { label: string; sales: number }[];
  by_method: Record<"Cash" | "UPI" | "Card", number>; top: { name: string; quantity: number }[];
};

export default function Reports() {
  const { t } = useTranslation();
  const [range, setRange] = useState<Range>("week");
  const q = useQuery<Report>({ queryKey: ["report", range], queryFn: () => apiGet(`/reports/sales?range=${range}`) });
  const r = q.data;
  const max = Math.max(1, ...(r?.buckets ?? []).map((b) => b.sales));
  const peak = r?.buckets.reduce((best, b, i, arr) => (b.sales > arr[best].sales ? i : best), 0) ?? -1;
  const period = range === "today" ? t("today") : range === "week" ? t("last 7 days") : t("this month");

  return (
    <Screen bg={colors.surface}>
      <Header title={t("Sales reports")} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 16 }}>
        <Segmented value={range} onChange={setRange}
          options={[{ value: "today", label: t("Today") }, { value: "week", label: t("Week") }, { value: "month", label: t("Month") }]} />
        {!r ? (q.isError ? <ErrorView message={(q.error as Error).message} onRetry={q.refetch} /> : <LoadingView />) : (
          <>
            <View style={{ padding: 16, borderRadius: radius.lg, backgroundColor: colors.greenTint, gap: 2 }}>
              <T v="label" color={colors.greenDark}>{t("Sales · {{period}}", { period })}</T>
              <T v="amount" testID="report-total">{formatCurrency(r.sales)}</T>
              <T v="small" color={colors.greenDark}>
                {r.profit > 0 ? t("{{n}} orders · profit about {{p}}", { n: r.orders, p: formatCurrency(r.profit) }) : t("{{n}} orders", { n: r.orders })}
              </T>
            </View>

            {/* One series, one axis: sales per bucket. Only the best bucket carries a number; the rest read by height. */}
            <View accessibilityLabel={r.buckets.map((b) => `${b.label} ${formatCurrency(b.sales)}`).join(", ")}
              style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 170, paddingTop: 22, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              {r.buckets.map((b, i) => (
                <View key={b.label} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  {i === peak && b.sales > 0 && (
                    <T v="caption" color={colors.ink} numberOfLines={1} style={{ position: "absolute", top: -20 }}>{formatCurrency(b.sales)}</T>
                  )}
                  <View style={{ width: "70%", maxWidth: 28, height: `${Math.max(b.sales ? 3 : 0, (b.sales / max) * 100)}%`,
                    borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: i === peak ? colors.green : colors.greenMid, opacity: i === peak ? 1 : 0.55 }} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: -10 }}>
              {r.buckets.map((b) => <T key={b.label} v="caption" style={{ flex: 1, textAlign: "center" }}>{b.label}</T>)}
            </View>

            <View style={{ gap: 8 }}>
              <T v="label" style={{ fontSize: 18 }}>{t("How customers paid")}</T>
              {(["Cash", "UPI", "Card"] as const).map((m) => {
                const share = r.sales ? Math.round((r.by_method[m] / r.sales) * 100) : 0;
                return (
                  <View key={m} style={{ gap: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <T v="bold">{t(m)}</T>
                      <T v="bold">{formatCurrency(r.by_method[m])} <T v="small">· {share}%</T></T>
                    </View>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.page }}>
                      <View style={{ width: `${share}%`, height: 8, borderRadius: 4, backgroundColor: colors.green }} />
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={{ gap: 6 }}>
              <T v="label" style={{ fontSize: 18 }}>{t("Best sellers")}</T>
              {r.top.length ? r.top.map((x, i) => (
                <View key={x.name} style={{ flexDirection: "row", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                  <T v="bold" color={colors.muted} style={{ width: 24 }}>{i + 1}</T>
                  <T v="bold" style={{ flex: 1 }}>{x.name}</T>
                  <T v="bold">{t("{{n}} sold", { n: formatQty(x.quantity) })}</T>
                </View>
              )) : <T v="small">{t("No sales yet")}</T>}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
