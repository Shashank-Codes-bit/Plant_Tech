import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/src/api";
import { formatCurrency } from "@/src/format";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { Card, Icon, LoadingView, StockBadge } from "@/src/components/ui";
import { useCart } from "@/src/cart-context";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function Home() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { count } = useCart();

  const business = useQuery({ queryKey: ["business"], queryFn: () => apiGet("/business") });
  const summary = useQuery({ queryKey: ["dashboard"], queryFn: () => apiGet("/dashboard/summary") });

  const today = summary.data?.today;
  const lowStock = summary.data?.low_stock ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl }}
      refreshControl={
        <RefreshControl refreshing={summary.isFetching} onRefresh={() => summary.refetch()} />
      }
      testID="home-screen"
    >
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>{greeting()}</Text>
          <Text style={s.business} numberOfLines={1}>
            {business.data?.business_name ?? "Your Nursery"}
          </Text>
        </View>
      </View>

      {/* Hero actions */}
      <View style={s.heroRow}>
        <HeroButton
          testID="home-scan-plant"
          icon="camera"
          label="Scan Plant"
          onPress={() => router.push("/scan")}
          bg={colors.brandPrimary}
          fg={colors.onBrandPrimary}
        />
        <HeroButton
          testID="home-new-bill"
          icon="cart-plus"
          label="New Bill"
          onPress={() => router.push("/(tabs)/billing")}
          bg={colors.brandSecondary}
          fg={colors.onBrandSecondary}
          badge={count}
        />
      </View>

      <View style={s.miniRow}>
        <MiniButton testID="home-add-inventory" icon="plus-box" label="Add Inventory" onPress={() => router.push("/product/new")} />
        <MiniButton testID="home-scan-invoice" icon="text-box-search" label="Scan Invoice" onPress={() => router.push("/scan-invoice")} />
      </View>

      {/* Today summary */}
      <Text style={s.sectionTitle}>Today</Text>
      {summary.isLoading ? (
        <LoadingView />
      ) : (
        <View style={s.statsGrid}>
          <StatCard label="Sales" value={formatCurrency(today?.sales)} highlight />
          <StatCard label="Bills" value={String(today?.bills ?? 0)} />
          <StatCard label="Items Sold" value={String(today?.items_sold ?? 0)} />
          <StatCard label="Cash" value={formatCurrency(today?.cash_collected)} />
        </View>
      )}

      {/* Low stock */}
      <View style={s.lowHeader}>
        <Text style={s.sectionTitle}>Low Stock</Text>
        {summary.data?.low_stock_count > 0 && (
          <View style={s.lowBadge}>
            <Text style={s.lowBadgeText}>{summary.data.low_stock_count}</Text>
          </View>
        )}
      </View>

      {lowStock.length === 0 ? (
        <Card style={{ marginHorizontal: spacing.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon name="check-circle" size={24} color={colors.success} />
            <Text style={{ fontSize: 16, color: colors.onSurface }}>All stock levels are healthy.</Text>
          </View>
        </Card>
      ) : (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {lowStock.slice(0, 3).map((p: any) => (
            <Card key={p.id} testID={`low-stock-${p.id}`} onPress={() => router.push(`/product/${p.id}`)} style={s.lowRow}>
              <Text style={s.lowName} numberOfLines={1}>
                {p.name}
              </Text>
              <StockBadge stock={p.stock} min={p.min_stock} />
            </Card>
          ))}
        </View>
      )}

      <Pressable testID="home-view-inventory" style={s.viewInv} onPress={() => router.push("/(tabs)/inventory")}>
        <Text style={s.viewInvText}>View Inventory</Text>
        <Icon name="arrow-right" size={20} color={colors.brandPrimary} />
      </Pressable>
    </ScrollView>
  );
}

function HeroButton({ testID, icon, label, onPress, bg, fg, badge }: any) {
  const s = useStyles();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [s.hero, { backgroundColor: bg }, pressed && { opacity: 0.88 }]}
    >
      {badge > 0 && (
        <View style={s.heroBadge}>
          <Text style={s.heroBadgeText}>{badge}</Text>
        </View>
      )}
      <Icon name={icon} size={40} color={fg} />
      <Text style={[s.heroLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

function MiniButton({ testID, icon, label, onPress }: any) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [s.mini, pressed && { opacity: 0.85 }]}
    >
      <Icon name={icon} size={24} color={colors.brandPrimary} />
      <Text style={s.miniLabel}>{label}</Text>
    </Pressable>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const s = useStyles();
  return (
    <View style={[s.stat, highlight && s.statHighlight]}>
      <Text style={[s.statValue, highlight && s.statValueHi]}>{value}</Text>
      <Text style={[s.statLabel, highlight && s.statLabelHi]}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  headerRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  greeting: { fontSize: 16, color: colors.muted, fontWeight: "600" },
  business: { fontSize: 28, fontWeight: "800", color: colors.onSurface },

  heroRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg },
  hero: {
    flex: 1,
    height: 130,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  heroLabel: { fontSize: 20, fontWeight: "800" },
  heroBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 13,
    backgroundColor: colors.warning,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadgeText: { color: colors.onWarning, fontWeight: "800", fontSize: 14 },

  miniRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  mini: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 60,
    borderRadius: 14,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniLabel: { fontSize: 16, fontWeight: "700", color: colors.onSurface },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.onSurface,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  stat: {
    width: "47.5%",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statHighlight: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  statValue: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  statValueHi: { color: colors.onBrandPrimary },
  statLabel: { fontSize: 15, color: colors.muted, marginTop: 2, fontWeight: "600" },
  statLabelHi: { color: colors.onBrandPrimary, opacity: 0.85 },

  lowHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  lowBadge: {
    marginTop: spacing.xl - 2,
    marginBottom: spacing.sm,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: colors.warning,
    alignItems: "center",
    justifyContent: "center",
  },
  lowBadgeText: { color: colors.onWarning, fontWeight: "800", fontSize: 13 },
  lowRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md },
  lowName: { fontSize: 17, fontWeight: "700", color: colors.onSurface, flex: 1, marginRight: 10 },

  viewInv: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
  },
  viewInvText: { fontSize: 17, fontWeight: "800", color: colors.brandPrimary },
}));
