import { ScrollView, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/src/api";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/ui";

export default function More() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const business = useQuery({ queryKey: ["business"], queryFn: () => apiGet("/business") });

  const items = [
    { icon: "receipt", label: "Invoice History", sub: "All past bills", onPress: () => router.push("/history"), testID: "more-history" },
    { icon: "text-box-search", label: "Scan Purchase Invoice", sub: "Add stock from supplier bill", onPress: () => router.push("/scan-invoice"), testID: "more-scan-invoice" },
    { icon: "shape-outline", label: "Categories", sub: "Manage product categories", onPress: () => router.push("/categories"), testID: "more-categories" },
    { icon: "store-cog", label: "Business Info", sub: "Edit nursery details & tax", onPress: () => router.push("/business-settings"), testID: "more-business" },
    { icon: "chart-line", label: "AI Insights", sub: "Coming soon", onPress: () => router.push("/ai-insights"), testID: "more-insights", badge: "Soon" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: spacing.xl }}
    >
      <Text style={s.title}>More</Text>

      <View style={s.businessCard}>
        <View style={s.logo}>
          <Icon name="sprout" size={28} color={colors.onBrandPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.bizName} numberOfLines={1}>
            {business.data?.business_name ?? "Your Nursery"}
          </Text>
          {!!business.data?.owner_name && <Text style={s.bizOwner}>{business.data.owner_name}</Text>}
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        {items.map((it) => (
          <Pressable key={it.label} testID={it.testID} style={s.row} onPress={it.onPress}>
            <View style={s.iconWrap}>
              <Icon name={it.icon as any} size={24} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>{it.label}</Text>
              <Text style={s.rowSub}>{it.sub}</Text>
            </View>
            {it.badge && (
              <View style={s.soon}>
                <Text style={s.soonText}>{it.badge}</Text>
              </View>
            )}
            <Icon name="chevron-right" size={24} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  title: { fontSize: 28, fontWeight: "800", color: colors.onSurface, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  businessCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  bizName: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  bizOwner: { fontSize: 15, color: colors.muted, marginTop: 2 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  rowSub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  soon: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.warning,
  },
  soonText: { fontSize: 12, fontWeight: "800", color: colors.onWarning },
}));
