// Employees (owner only), two tabs:
// Performance: who billed what in a day, week or month (orders, sales, items, average bill, customers,
//   price changes); tap a person to see their orders for that period.
// Manage: the employees' logins and what each may do; add an employee.
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet } from "@/src/api";
import { Period, PeriodBar, usePeriod } from "@/src/components/period";
import { Badge, BottomBar, Button, EmptyState, ErrorView, Header, Icon, LoadingView, Row, Screen, Segmented, T } from "@/src/components/ui";
import { formatCurrency, formatPhone, formatTime, plural } from "@/src/format";
import { useRefreshOnFocus } from "@/src/hooks/useRefreshOnFocus";
import { colors, radius, spacing } from "@/src/theme";
import type { Worker } from "@/src/types";

type Person = {
  id: string; name: string; role: "owner" | "employee"; active: boolean; orders: number; sales: number; items: number;
  avg_bill: number; discount: number; customers: number; first_at: string | null; last_at: string | null; share: number;
  price_changes: { lines: number; less: number };
};
type Report = { start: string; end: string; sales: number; orders: number; people: Person[] };

export default function Employees() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"performance" | "manage">("performance");
  const period = usePeriod("day");
  return (
    <Screen bg={colors.surface}>
      <Header title={t("Employees")} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: 8 }}>
        <Segmented value={tab} onChange={setTab}
          options={[{ value: "performance", label: t("Performance") }, { value: "manage", label: t("Manage") }]} />
      </View>
      {tab === "performance" ? <Performance p={period} /> : <Manage />}
    </Screen>
  );
}

function Performance({ p }: { p: Period }) {
  const { t } = useTranslation();
  const router = useRouter();
  const q = useQuery<Report>({ queryKey: ["employee-report", p.kind, p.anchor], queryFn: () => apiGet(`/reports/employees?range=${p.kind}&date=${p.anchor}`) });
  useRefreshOnFocus(q.refetch);
  const r = q.data;
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 8, gap: 14, paddingBottom: spacing.xl }}>
      <PeriodBar p={p} />
      {!r ? (q.isError ? <ErrorView message={(q.error as Error).message} onRetry={q.refetch} /> : <LoadingView />) : (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 2 }}>
            <T v="label">{plural(r.orders, "1 order", "{{n}} orders")}</T>
            <T v="title" testID="employees-total">{formatCurrency(r.sales)}</T>
          </View>
          {r.people.map((x) => (
            <PersonCard key={x.id} x={x} day={p.kind === "day"}
              onPress={() => router.push({ pathname: "/more/employee-orders", params: { id: x.id, name: x.name, from: r.start, to: r.end } })} />
          ))}
          {r.people.length <= 1 && (
            <T v="small" style={{ textAlign: "center" }}>{t("Add employees in Manage to see how each one is doing.")}</T>
          )}
        </>
      )}
    </ScrollView>
  );
}

function PersonCard({ x, day, onPress }: { x: Person; day: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const idle = !x.orders;
  const facts = [
    plural(x.orders, "1 order", "{{n}} orders"),
    !idle && plural(x.items, "1 item", "{{n}} items"),
    !idle && t("avg {{amount}}", { amount: formatCurrency(Math.round(x.avg_bill)) }),
    !idle && plural(x.customers, "1 customer", "{{n}} customers"),
  ].filter(Boolean).join(" · ");
  return (
    <Pressable onPress={onPress} disabled={idle} testID={`employee-${x.name}`} accessibilityRole="button"
      style={({ pressed }) => ({ gap: 8, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line,
        backgroundColor: pressed ? colors.page : colors.surface })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: idle ? colors.page : colors.greenTint, alignItems: "center", justifyContent: "center" }}>
          <T v="number" color={idle ? colors.muted : colors.greenDark}>{(x.name || "?").charAt(0).toUpperCase()}</T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="bold">{x.name}</T>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Badge text={x.role === "owner" ? t("Owner") : t("Employee")} tone={x.role === "owner" ? "green" : "blue"} />
            {!x.active && x.role !== "owner" && <Badge text={t("switched off")} tone="grey" />}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <T v="title" style={{ fontSize: 22 }}>{formatCurrency(x.sales)}</T>
          {!idle && <T v="caption">{t("{{p}}% of sales", { p: Math.round(x.share * 100) })}</T>}
        </View>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.page }}>
        <View style={{ width: `${Math.round(x.share * 100)}%`, height: 6, borderRadius: 3, backgroundColor: colors.green }} />
      </View>
      <T v="small">{facts}</T>
      {!idle && day && x.first_at && (
        <T v="small">{t("First bill {{first}} · last {{last}}", { first: formatTime(x.first_at), last: formatTime(x.last_at) })}</T>
      )}
      {(x.price_changes.lines > 0 || x.discount > 0) && (
        <T v="small" color={colors.amberInk}>
          {[x.price_changes.lines > 0 && (x.price_changes.less >= 0
              ? t("Price changed on {{lines}} · {{amount}} below shop price", { lines: plural(x.price_changes.lines, "1 line", "{{n}} lines"), amount: formatCurrency(x.price_changes.less) })
              : t("Price changed on {{lines}} · {{amount}} above shop price", { lines: plural(x.price_changes.lines, "1 line", "{{n}} lines"), amount: formatCurrency(-x.price_changes.less) })),
            x.discount > 0 && t("discount {{amount}}", { amount: formatCurrency(x.discount) })].filter(Boolean).join(" · ")}
        </T>
      )}
      {!idle && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end" }}>
          <T v="bold" color={colors.green}>{t("See orders")}</T>
          <Icon name="chevron-right" size={20} color={colors.green} />
        </View>
      )}
    </Pressable>
  );
}

function Manage() {
  const { t } = useTranslation();
  const router = useRouter();
  const q = useQuery<Worker[]>({ queryKey: ["staff"], queryFn: () => apiGet("/staff") });
  useRefreshOnFocus(q.refetch);
  const labels = { sell: t("Billing"), stock: t("Add stock"), customers: t("Customers"), reports: t("Reports") };
  return (
    <>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 8, gap: 10 }}>
        <T v="body" color={colors.inkSoft}>{t("Employees log in with their phone number and the PIN you set.")}</T>
        {q.isLoading ? <LoadingView /> : q.isError ? <ErrorView message={(q.error as Error).message} onRetry={q.refetch} />
          : !q.data?.length ? <EmptyState icon="account-multiple-plus" title={t("No employees yet")} subtitle={t("Add an employee so they can make bills on their own phone.")} />
          : q.data.map((w) => (
            <View key={w.id} style={{ gap: 6 }}>
              <Row title={w.name} chevron testID={`staff-${w.name}`}
                subtitle={`${formatPhone(w.phone)} · ${w.active ? t("active") : t("switched off")}`}
                left={<View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: w.active ? colors.greenTint : colors.page,
                  alignItems: "center", justifyContent: "center" }}><T v="number" color={w.active ? colors.greenDark : colors.muted}>{w.name.charAt(0).toUpperCase()}</T></View>}
                onPress={() => router.push({ pathname: "/more/staff-edit", params: { id: w.id } })} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingLeft: 4 }}>
                {(Object.keys(labels) as (keyof typeof labels)[]).filter((p) => w.permissions[p]).map((p) => (
                  <Badge key={p} text={labels[p]} tone={w.active ? "green" : "grey"} />
                ))}
              </View>
            </View>
          ))}
      </ScrollView>
      <BottomBar>
        <Button title={t("Add employee")} icon="account-plus" onPress={() => router.push("/more/staff-edit")} testID="staff-add" />
      </BottomBar>
    </>
  );
}
