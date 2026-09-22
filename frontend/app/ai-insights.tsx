import { ScrollView, Text, View } from "react-native";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/ui";
import { Header } from "@/src/components/header";

const FUTURE = [
  { icon: "trending-up", title: "Best-selling plants", sub: "See what moves fastest each week" },
  { icon: "clock-alert-outline", title: "Slow-moving stock", sub: "Spot plants sitting too long" },
  { icon: "cart-arrow-down", title: "Smart restocking", sub: "What should I reorder this week?" },
  { icon: "weather-partly-cloudy", title: "Seasonal demand", sub: "Plan for festival & seasonal spikes" },
  { icon: "tag-multiple", title: "Suggested pricing", sub: "Margin-aware price recommendations" },
  { icon: "chart-box", title: "Sales forecasting", sub: "Predict next week's sales" },
];

export default function AiInsights() {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="AI Insights" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={s.hero}>
          <Icon name="creation" size={40} color={colors.onBrandPrimary} />
          <Text style={s.heroTitle}>Coming Soon</Text>
          <Text style={s.heroSub}>Smart insights to help you sell more and waste less. Your sales data is already being collected.</Text>
        </View>

        {FUTURE.map((f) => (
          <View key={f.title} style={s.row}>
            <View style={s.iconWrap}>
              <Icon name={f.icon as any} size={24} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{f.title}</Text>
              <Text style={s.rowSub}>{f.sub}</Text>
            </View>
            <View style={s.soon}>
              <Text style={s.soonText}>Soon</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  hero: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: 8,
  },
  heroTitle: { fontSize: 26, fontWeight: "800", color: colors.onBrandPrimary },
  heroSub: { fontSize: 15, color: colors.onBrandPrimary, opacity: 0.9, textAlign: "center", lineHeight: 21 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  rowSub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  soon: { backgroundColor: colors.warning, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  soonText: { fontSize: 12, fontWeight: "800", color: colors.onWarning },
}));
