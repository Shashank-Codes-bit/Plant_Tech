// Orders: the whole order history, newest first, loaded as you scroll, in days with each day's total.
// Filters: search (customer, phone, bill no.), dates, payment type, and who made it (owner).
// Workers only ever get the bills they made (the server enforces it).
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, SectionList, TextInput, View } from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet } from "@/src/api";
import { useAuth } from "@/src/auth";
import { CalendarSheet, Range } from "@/src/components/calendar";
import { OrderRow, OrderSummary } from "@/src/components/order-row";
import { FilterChip, OptionRow, Sheet } from "@/src/components/sheet";
import { EmptyState, ErrorView, Icon, LoadingView, Screen, T } from "@/src/components/ui";
import { dayLabelLong, mondayOf, monthStart, rangeLabel } from "@/src/dates";
import { formatCurrency, todayKey } from "@/src/format";
import { useRefreshOnFocus } from "@/src/hooks/useRefreshOnFocus";
import { colors, fonts, radius, spacing } from "@/src/theme";
import type { Worker } from "@/src/types";

type DateKind = "all" | "today" | "yesterday" | "week" | "month" | "pick";
type Summary = { orders: number; sales: number; by_method: Record<"Cash" | "UPI" | "Card", number>; by_day: Record<string, { orders: number; sales: number }> };
const PAGE = 40;
const istDay = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

export default function Orders() {
  const { t } = useTranslation();
  const { isOwner, can, user } = useAuth();
  const seesAll = isOwner || can("reports");
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [dateKind, setDateKind] = useState<DateKind>("all");
  const [picked, setPicked] = useState<Range | null>(null);
  const [method, setMethod] = useState<"" | "Cash" | "UPI" | "Card">("");
  const [madeBy, setMadeBy] = useState("");
  const [sheet, setSheet] = useState<"" | "date" | "method" | "who" | "calendar">("");

  useEffect(() => {
    const id = setTimeout(() => setSearch(typed.trim()), 350);
    return () => clearTimeout(id);
  }, [typed]);

  const range: Range | null = useMemo(() => {
    const today = todayKey();
    switch (dateKind) {
      case "today": return { from: today, to: today };
      case "yesterday": return { from: todayKey(1), to: todayKey(1) };
      case "week": return { from: mondayOf(today), to: today };
      case "month": return { from: monthStart(today), to: today };
      case "pick": return picked;
      default: return null;
    }
  }, [dateKind, picked]);

  const params = new URLSearchParams();
  if (range) {
    params.set("date_from", range.from);
    params.set("date_to", range.to);
  }
  if (method) params.set("method", method);
  if (madeBy) params.set("made_by", madeBy);
  if (search) params.set("search", search);
  const qs = params.toString();

  const list = useInfiniteQuery({
    queryKey: ["orders", qs],
    queryFn: ({ pageParam }) => apiGet(`/invoices?limit=${PAGE}${qs ? `&${qs}` : ""}${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ""}`) as Promise<OrderSummary[]>,
    initialPageParam: "",
    getNextPageParam: (last: OrderSummary[]) => (last.length === PAGE ? last[last.length - 1].created_at : undefined),
  });
  const summary = useQuery<Summary>({ queryKey: ["orders-summary", qs], queryFn: () => apiGet(`/invoices/summary${qs ? `?${qs}` : ""}`) });
  const staff = useQuery<Worker[]>({ queryKey: ["staff"], queryFn: () => apiGet("/staff"), enabled: isOwner });
  useRefreshOnFocus(list.refetch);
  useRefreshOnFocus(summary.refetch);

  const sections = useMemo(() => {
    const byDay = new Map<string, OrderSummary[]>();
    for (const o of list.data?.pages.flat() ?? []) {
      const k = istDay(o.created_at);
      byDay.set(k, [...(byDay.get(k) ?? []), o]);
    }
    return [...byDay.entries()].map(([day, data]) => ({ day, data }));
  }, [list.data]);

  const dateValue = dateKind === "all" ? "" : dateKind === "pick" && range ? rangeLabel(range.from, range.to)
    : { today: t("Today"), yesterday: t("Yesterday"), week: t("This week"), month: t("This month") }[dateKind as "today"];
  const people = [{ id: user?.id ?? "", name: t("Me ({{name}})", { name: user?.name ?? "" }) }, ...(staff.data ?? []).map((w) => ({ id: w.id, name: w.name }))];
  const whoValue = madeBy ? people.find((p) => p.id === madeBy)?.name : "";
  const filtered = !!(range || method || madeBy || search);
  const s = summary.data;

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 10, gap: 10, backgroundColor: colors.surface,
        borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <T v="title">{seesAll ? t("Orders") : t("My orders")}</T>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 14, borderWidth: 2,
          borderColor: typed ? colors.green : colors.lineStrong, borderRadius: 16 }}>
          <Icon name="magnify" size={24} color={colors.muted} />
          <TextInput value={typed} onChangeText={setTyped} placeholder={t("Customer, phone or bill no.")} placeholderTextColor={colors.muted}
            testID="orders-search" style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 18, color: colors.ink, minHeight: 48 }} />
          {!!typed && (
            <Pressable accessibilityLabel={t("Clear")} onPress={() => setTyped("")} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <Icon name="close-circle" size={22} color={colors.muted} />
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChip label={t("All dates")} value={dateValue} icon="calendar" onPress={() => setSheet("date")} testID="orders-filter-date" />
          <FilterChip label={t("Payment")} value={method ? t(method) : ""} icon="cash-multiple" onPress={() => setSheet("method")} testID="orders-filter-method" />
          {isOwner && <FilterChip label={t("Made by")} value={whoValue} icon="account" onPress={() => setSheet("who")} testID="orders-filter-who" />}
          {filtered && (
            <Pressable onPress={() => { setTyped(""); setDateKind("all"); setMethod(""); setMadeBy(""); }}
              style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 10 }} testID="orders-clear">
              <T v="bold" color={colors.red}>{t("Clear all")}</T>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {list.isLoading ? <LoadingView /> : list.isError ? <ErrorView message={(list.error as Error).message} onRetry={list.refetch} /> : (
        <SectionList
          sections={sections}
          keyExtractor={(o) => o.id}
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => { list.refetch(); summary.refetch(); }} tintColor={colors.green} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage(); }}
          ListHeaderComponent={s ? (
            <View style={{ marginTop: 12, padding: 14, borderRadius: radius.lg, backgroundColor: colors.greenTint, gap: 6 }} testID="orders-summary">
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <T v="bold" color={colors.greenDark}>{s.orders === 1 ? t("1 order") : t("{{n}} orders", { n: s.orders })}</T>
                <T v="title" color={colors.greenDark}>{formatCurrency(s.sales)}</T>
              </View>
              <T v="small" color={colors.greenDark}>
                {(["Cash", "UPI", "Card"] as const).map((m) => `${t(m)} ${formatCurrency(s.by_method[m])}`).join("  ·  ")}
              </T>
            </View>
          ) : null}
          renderSectionHeader={({ section }) => {
            const d = s?.by_day[section.day];
            return (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8, paddingTop: 16, paddingBottom: 8,
                backgroundColor: colors.page }}>
                <T v="bold">{dayLabelLong(section.day)}</T>
                {!!d && <T v="label">{t("{{n}} orders · {{total}}", { n: d.orders, total: formatCurrency(d.sales) })}</T>}
              </View>
            );
          }}
          renderItem={({ item }) => <View style={{ marginBottom: 8 }}><OrderRow o={item} showBy={seesAll} /></View>}
          ListEmptyComponent={<EmptyState icon="receipt-text-outline" title={filtered ? t("No orders match") : t("No orders yet")}
            subtitle={filtered ? t("Try other filters, or Clear all.") : undefined} />}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.green} style={{ margin: 16 }} />
            : !list.hasNextPage && sections.length ? <T v="caption" style={{ textAlign: "center", marginTop: 8 }}>{t("That's all the orders")}</T> : null}
        />
      )}

      <Sheet visible={sheet === "date"} onClose={() => setSheet("")} title={t("Dates")}>
        {([["all", t("All dates")], ["today", t("Today")], ["yesterday", t("Yesterday")], ["week", t("This week")], ["month", t("This month")]] as const).map(([k, label]) => (
          <OptionRow key={k} label={label} selected={dateKind === k} onPress={() => { setDateKind(k); setSheet(""); }} testID={`orders-date-${k}`} />
        ))}
        <OptionRow label={t("Choose dates…")} sub={dateKind === "pick" && range ? rangeLabel(range.from, range.to) : t("One day, or from – to")}
          icon="calendar-range" selected={dateKind === "pick"} onPress={() => setSheet("calendar")} testID="orders-date-pick" />
      </Sheet>
      {sheet === "calendar" && (
        <CalendarSheet visible onClose={() => setSheet("")} title={t("Choose dates")} mode="range" initial={range ?? undefined}
          onPick={(r) => { setPicked(r); setDateKind("pick"); }} />
      )}
      <Sheet visible={sheet === "method"} onClose={() => setSheet("")} title={t("Payment")}>
        {(["", "Cash", "UPI", "Card"] as const).map((m) => (
          <OptionRow key={m || "all"} label={m ? t(m) : t("All payments")} selected={method === m}
            icon={m === "Cash" ? "cash" : m === "UPI" ? "qrcode" : m === "Card" ? "credit-card-outline" : undefined}
            onPress={() => { setMethod(m); setSheet(""); }} testID={`orders-method-${m || "all"}`} />
        ))}
      </Sheet>
      <Sheet visible={sheet === "who"} onClose={() => setSheet("")} title={t("Made by")}>
        <OptionRow label={t("Everyone")} selected={!madeBy} onPress={() => { setMadeBy(""); setSheet(""); }} />
        {people.map((p) => (
          <OptionRow key={p.id} label={p.name} selected={madeBy === p.id} onPress={() => { setMadeBy(p.id); setSheet(""); }} />
        ))}
      </Sheet>
    </Screen>
  );
}

