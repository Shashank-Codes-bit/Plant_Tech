// Home: only the New order button and today's numbers.
// The owner sees the whole shop's day; a worker sees their own sales.
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useCart } from "@/src/cart-context";
import { OrderRow, OrderSummary } from "@/src/components/order-row";
import { Badge, Card, EmptyState, ErrorView, Icon, Screen, SectionTitle, T, Thumb } from "@/src/components/ui";
import { formatCurrency, formatToday } from "@/src/format";
import { useRefreshOnFocus } from "@/src/hooks/useRefreshOnFocus";
import { colors, radius, spacing } from "@/src/theme";

type Today = { scope: "shop" | "mine"; sales: number; orders: number; by_method: Record<"Cash" | "UPI" | "Card", number>; recent: OrderSummary[] };

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, isOwner, can } = useAuth();
  const cart = useCart();
  const today = useQuery<Today>({ queryKey: ["today"], queryFn: () => apiGet("/dashboard/today"), enabled: can("sell") });
  useRefreshOnFocus(today.refetch);
  const d = today.data;
  const shop = user?.business?.name || t("Your shop");

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 16, paddingBottom: spacing["2xl"] }}
        refreshControl={<RefreshControl refreshing={today.isRefetching} onRefresh={today.refetch} tintColor={colors.green} />}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 4 }}>
          {!!user?.business?.logo_path && <Thumb path={user.business.logo_path} size={52} icon="store" tint={colors.surface} contain />}
          <View style={{ flex: 1 }}>
            <T v="label">{isOwner ? formatToday() : shop}</T>
            <T v="title" numberOfLines={1}>{isOwner ? shop : t("Hello, {{name}}", { name: user?.name ?? "" })}</T>
          </View>
          {isOwner ? (
            <Pressable accessibilityLabel={t("Account")} onPress={() => router.push("/(tabs)/more")}
              style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center" }}>
              <T v="number" color={colors.greenDark}>{(user?.name || "?").charAt(0).toUpperCase()}</T>
            </Pressable>
          ) : <Badge text={t("Worker")} tone="blue" />}
        </View>

        {can("sell") ? (
          <Pressable testID="home-new-order" accessibilityRole="button" onPress={() => router.push("/order/scan")}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 16, padding: 20, minHeight: 112, borderRadius: radius.xl,
              backgroundColor: pressed ? colors.greenDark : colors.green })}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}>
              <Icon name="cart-plus" size={34} color={colors.green} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="title" color={colors.white}>{t("New order")}</T>
              <T v="body" color={colors.greenOnDark}>
                {cart.count ? t("{{n}} items waiting · {{total}}", { n: cart.count, total: formatCurrency(cart.total) }) : t("Scan or search a plant")}
              </T>
            </View>
            <Icon name="chevron-right" size={34} color={colors.white} />
          </Pressable>
        ) : (
          <Card>
            <EmptyState icon="lock" title={t("Billing is off for you")} subtitle={t("Ask the shop owner to turn it on.")} />
          </Card>
        )}

        {can("sell") && today.isError && <ErrorView message={(today.error as Error).message} onRetry={today.refetch} />}

        {d && d.scope === "shop" && (
          <Card style={{ gap: 12 }} testID="home-today">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <T v="label">{t("Today's sales")}</T>
              <T v="bold" color={colors.inkSoft}>{d.orders === 1 ? t("1 order") : t("{{n}} orders", { n: d.orders })}</T>
            </View>
            <T v="amount" numberOfLines={1} adjustsFontSizeToFit testID="home-sales">{formatCurrency(d.sales)}</T>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["Cash", "UPI", "Card"] as const).map((m) => (
                <View key={m} style={{ flex: 1, padding: 10, borderRadius: radius.md, backgroundColor: colors.page }}>
                  <T v="label">{t(m)}</T>
                  <T v="number" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 20 }}>{formatCurrency(d.by_method[m])}</T>
                </View>
              ))}
            </View>
          </Card>
        )}

        {d && d.scope === "mine" && (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }} testID="home-today">
            <View style={{ flex: 1 }}>
              <T v="label">{t("Your sales today")}</T>
              <T v="amount" testID="home-sales">{formatCurrency(d.sales)}</T>
            </View>
            <View style={{ alignItems: "center", padding: 12, minWidth: 84, borderRadius: radius.md, backgroundColor: colors.page }}>
              <T v="title">{d.orders}</T>
              <T v="label">{d.orders === 1 ? t("order") : t("orders")}</T>
            </View>
          </Card>
        )}

        {d && (
          <View style={{ gap: 8 }}>
            <SectionTitle right={d.recent.length ? (
              <Pressable onPress={() => router.push("/(tabs)/orders")} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
                <T v="bold" color={colors.green}>{t("See all")}</T>
              </Pressable>
            ) : undefined}>
              {d.scope === "shop" ? t("Today's orders") : t("Your orders today")}
            </SectionTitle>
            {d.recent.length ? d.recent.slice(0, 5).map((o) => <OrderRow key={o.id} o={o} showBy={d.scope === "shop"} />)
              : <T v="small">{t("No orders yet today. Tap New order to make the first bill.")}</T>}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
