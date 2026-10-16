// Sales reports for a chosen date, week (Monday to Sunday) or month: total, profit, chart,
// how customers paid, best sellers. ◀ ▶ step through periods; tapping the date opens a picker.
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet } from "@/src/api";
import { CalendarSheet, MonthSheet } from "@/src/components/calendar";
import { ErrorView, Header, Icon, LoadingView, Screen, Segmented, T } from "@/src/components/ui";
import { addDays, addMonths, dayLabelLong, mondayOf, monthLabel, monthStart, rangeLabel } from "@/src/dates";
import { formatCurrency, formatQty, todayKey } from "@/src/format";
import { colors, radius, spacing, touch } from "@/src/theme";

type Kind = "day" | "week" | "month";
type Report = {
  start: string; end: string; sales: number; orders: number; profit: number; buckets: { label: string; sales: number }[];
  by_method: Record<"Cash" | "UPI" | "Card", number>; top: { name: string; quantity: number }[];
};

export default function Reports() {
  const { t } = useTranslation();
  const today = todayKey();
  const [kind, setKind] = useState<Kind>("day");
  const [anchor, setAnchor] = useState(today);
  const [picker, setPicker] = useState(false);
  const q = useQuery<Report>({ queryKey: ["report", kind, anchor], queryFn: () => apiGet(`/reports/sales?range=${kind}&date=${anchor}`) });
  const r = q.data;

  // The period that holds `anchor`, its label, and the next / previous anchor.
  const start = kind === "day" ? anchor : kind === "week" ? mondayOf(anchor) : monthStart(anchor);
  const end = kind === "day" ? anchor : kind === "week" ? addDays(start, 6) : addDays(addMonths(start, 1), -1);
  const label = kind === "day" ? dayLabelLong(anchor) : kind === "week" ? rangeLabel(start, end) : monthLabel(anchor);
  const isCurrent = today >= start && today <= end;
  const step = (n: number) => setAnchor(kind === "day" ? addDays(anchor, n) : kind === "week" ? addDays(start, 7 * n) : addMonths(start, n));
  const next = kind === "day" ? addDays(anchor, 1) : kind === "week" ? addDays(start, 7) : addMonths(start, 1);
  const canNext = next <= today;
  const pickKind = (k: Kind) => {
    if (k === kind) setPicker(true); // tapping the chosen tab again opens the picker
    setKind(k);
  };

  const max = Math.max(1, ...(r?.buckets ?? []).map((b) => b.sales));
  const peak = r?.buckets.reduce((best, b, i, arr) => (b.sales > arr[best].sales ? i : best), 0) ?? -1;
  const navBtn = { width: touch.min, height: touch.min, borderRadius: 28, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: colors.page };

  return (
    <Screen bg={colors.surface}>
      <Header title={t("Sales reports")} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 4, gap: 16 }}>
        <Segmented value={kind} onChange={pickKind}
          options={[{ value: "day", label: t("Date") }, { value: "week", label: t("Week") }, { value: "month", label: t("Month") }]} />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable accessibilityLabel={t("Earlier")} onPress={() => step(-1)} style={navBtn} testID="report-prev">
            <Icon name="chevron-left" size={30} color={colors.ink} />
          </Pressable>
          <Pressable onPress={() => setPicker(true)} testID="report-pick"
            style={({ pressed }) => ({ flex: 1, minHeight: touch.min, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
              paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 2, borderColor: colors.green, backgroundColor: pressed ? colors.greenTint : colors.surface })}>
            <Icon name="calendar-month-outline" size={22} color={colors.green} />
            <T v="bold" color={colors.greenDark} style={{ textAlign: "center", flexShrink: 1 }}>{label}</T>
          </Pressable>
          <Pressable accessibilityLabel={t("Later")} onPress={() => step(1)} disabled={!canNext} style={[navBtn, { opacity: canNext ? 1 : 0.35 }]} testID="report-next">
            <Icon name="chevron-right" size={30} color={colors.ink} />
          </Pressable>
        </View>
        {!isCurrent && (
          <Pressable onPress={() => setAnchor(today)} style={{ alignSelf: "center", minHeight: 40, justifyContent: "center", marginTop: -8 }}>
            <T v="bold" color={colors.green}>{kind === "day" ? t("Back to today") : kind === "week" ? t("Back to this week") : t("Back to this month")}</T>
          </Pressable>
        )}

        {!r ? (q.isError ? <ErrorView message={(q.error as Error).message} onRetry={q.refetch} /> : <LoadingView />) : (
          <>
            <View style={{ padding: 16, borderRadius: radius.lg, backgroundColor: colors.greenTint, gap: 2 }}>
              <T v="label" color={colors.greenDark}>{t("Sales")}</T>
              <T v="amount" testID="report-total">{formatCurrency(r.sales)}</T>
              <T v="small" color={colors.greenDark}>
                {[r.orders === 1 ? t("1 order") : t("{{n}} orders", { n: r.orders }), r.profit > 0 ? t("profit about {{p}}", { p: formatCurrency(Math.round(r.profit)) }) : ""]
                  .filter(Boolean).join(" · ")}
              </T>
            </View>

            {/* One series, one axis: sales per bucket. Only the best bucket carries a number; the rest read by height. */}
            <View accessibilityLabel={r.buckets.map((b) => `${b.label} ${formatCurrency(b.sales)}`).join(", ")}
              style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 170, paddingTop: 22, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              {r.buckets.map((b, i) => (
                <View key={b.label} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  {i === peak && b.sales > 0 && (
                    <T v="caption" color={colors.ink} style={{ position: "absolute", top: -20, width: 90, textAlign: "center" }}>{formatCurrency(b.sales)}</T>
                  )}
                  <View style={{ width: "70%", maxWidth: 28, height: `${Math.max(b.sales ? 3 : 0, (b.sales / max) * 100)}%`,
                    borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: i === peak ? colors.green : colors.greenMid, opacity: i === peak ? 1 : 0.55 }} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: -10 }}>
              {r.buckets.map((b) => <T key={b.label} v="caption" style={{ flex: 1, textAlign: "center", fontSize: 12 }}>{b.label}</T>)}
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
              )) : <T v="small">{t("No sales in this period")}</T>}
            </View>
          </>
        )}
      </ScrollView>

      {picker && kind === "month" && (
        <MonthSheet visible onClose={() => setPicker(false)} value={anchor} onPick={(k) => setAnchor(k)} />
      )}
      {picker && kind !== "month" && (
        <CalendarSheet visible onClose={() => setPicker(false)} title={kind === "day" ? t("Pick a date") : t("Pick a week")} mode={kind === "day" ? "day" : "week"}
          initial={{ from: start, to: end }} onPick={(rng) => setAnchor(rng.from)} />
      )}
    </Screen>
  );
}
