// Orders by day (last 7 days). Workers see only the bills they made.
import { useState } from "react";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet } from "@/src/api";
import { useAuth } from "@/src/auth";
import { OrderRow, OrderSummary } from "@/src/components/order-row";
import { Chip, EmptyState, ErrorView, LoadingView, Screen, T } from "@/src/components/ui";
import { dayLabel, formatCurrency, todayKey } from "@/src/format";
import { useRefreshOnFocus } from "@/src/hooks/useRefreshOnFocus";
import { colors, spacing } from "@/src/theme";

const DAYS = Array.from({ length: 7 }, (_, i) => i);

export default function Orders() {
  const { t } = useTranslation();
  const { isOwner, can } = useAuth();
  const [ago, setAgo] = useState(0);
  const day = todayKey(ago);
  const q = useQuery<OrderSummary[]>({ queryKey: ["orders", day], queryFn: () => apiGet(`/invoices?day=${day}`) });
  useRefreshOnFocus(q.refetch);
  const seesAll = isOwner || can("reports");
  const total = (q.data ?? []).reduce((s, o) => s + o.grand_total, 0);

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 10, backgroundColor: colors.surface, paddingBottom: 12 }}>
        <T v="title">{seesAll ? t("Orders") : t("My orders")}</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {DAYS.map((d) => (
            <Chip key={d} label={dayLabel(todayKey(d), d)} active={d === ago} onPress={() => setAgo(d)} testID={`orders-day-${d}`} />
          ))}
        </ScrollView>
      </View>
      {q.isLoading ? <LoadingView /> : q.isError ? <ErrorView message={(q.error as Error).message} onRetry={q.refetch} /> : (
        <FlatList
          data={q.data}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing.lg, gap: 8 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.green} />}
          ListHeaderComponent={q.data?.length ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 4 }}>
              <T v="label">{q.data.length === 1 ? t("1 order") : t("{{n}} orders", { n: q.data.length })}</T>
              <T v="bold">{formatCurrency(total)}</T>
            </View>
          ) : null}
          ListEmptyComponent={<EmptyState icon="receipt-text-outline" title={t("No orders on this day")} />}
          renderItem={({ item }) => <OrderRow o={item} showBy={seesAll} />}
        />
      )}
    </Screen>
  );
}
