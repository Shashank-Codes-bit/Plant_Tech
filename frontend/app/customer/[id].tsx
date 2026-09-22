import { ScrollView, Text, View, Pressable, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/src/api";
import { formatCurrency, formatDate } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon, LoadingView } from "@/src/components/ui";
import { Header } from "@/src/components/header";

export default function CustomerDetail() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const customer = useQuery({ queryKey: ["customer", id], queryFn: () => apiGet(`/customers/${id}`) });
  const c = customer.data;

  if (customer.isLoading || !c) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title="Customer" />
        <LoadingView />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={c.name} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <View style={s.card}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{c.name?.[0]?.toUpperCase()}</Text>
          </View>
          <Text style={s.name}>{c.name}</Text>
          {!!c.phone && (
            <Pressable style={s.contactRow} onPress={() => Linking.openURL(`tel:${c.phone}`)} testID="customer-call">
              <Icon name="phone" size={20} color={colors.brandPrimary} />
              <Text style={s.contactText}>{c.phone}</Text>
            </Pressable>
          )}
          {!!c.email && <Text style={s.meta}>{c.email}</Text>}
          {!!c.address && <Text style={s.meta}>{c.address}</Text>}
        </View>

        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statValue}>{formatCurrency(c.total_purchases)}</Text>
            <Text style={s.statLabel}>Total Spent</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statValue}>{c.purchase_count}</Text>
            <Text style={s.statLabel}>Total Bills</Text>
          </View>
        </View>

        <Text style={s.section}>Purchase History</Text>
        {(c.invoices ?? []).length === 0 ? (
          <Text style={s.empty}>No purchases yet.</Text>
        ) : (
          c.invoices.map((inv: any) => (
            <Pressable key={inv.id} style={s.invRow} onPress={() => router.push(`/invoice/${inv.id}`)} testID={`customer-invoice-${inv.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={s.invNo}>{inv.invoice_number}</Text>
                <Text style={s.invDate}>{formatDate(inv.created_at)}</Text>
              </View>
              <Text style={s.invAmount}>{formatCurrency(inv.grand_total)}</Text>
              <Icon name="chevron-right" size={22} color={colors.muted} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { alignItems: "center", gap: 6 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 34, fontWeight: "800", color: colors.brandPrimary },
  name: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  contactText: { fontSize: 17, fontWeight: "700", color: colors.brandPrimary },
  meta: { fontSize: 15, color: colors.muted },

  statsRow: { flexDirection: "row", gap: spacing.md },
  stat: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.brandPrimary },
  statLabel: { fontSize: 14, color: colors.muted, marginTop: 2 },

  section: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  empty: { fontSize: 15, color: colors.muted },
  invRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  invNo: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  invDate: { fontSize: 13, color: colors.muted, marginTop: 2 },
  invAmount: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
}));
