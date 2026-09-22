import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/src/api";
import { formatCurrency, formatDate } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, Icon, LoadingView } from "@/src/components/ui";
import { Header } from "@/src/components/header";

export default function History() {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const invoices = useQuery({
    queryKey: ["invoices", search],
    queryFn: () => apiGet(`/invoices?search=${encodeURIComponent(search)}`),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Invoice History" />
      <View style={s.searchWrap}>
        <View style={s.searchBox}>
          <Icon name="magnify" size={22} color={colors.muted} />
          <TextInput
            testID="history-search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search invoice, customer, phone"
            placeholderTextColor={colors.muted}
            style={s.searchInput}
          />
        </View>
      </View>

      {invoices.isLoading ? (
        <LoadingView />
      ) : (invoices.data ?? []).length === 0 ? (
        <EmptyState icon="receipt" title="No invoices yet" subtitle="Completed sales will appear here." />
      ) : (
        <FlatList
          data={invoices.data}
          keyExtractor={(i: any) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => router.push(`/invoice/${item.id}`)} testID={`history-item-${item.id}`}>
              <View style={s.iconWrap}>
                <Icon name="receipt" size={24} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.invNo}>{item.invoice_number}</Text>
                <Text style={s.meta}>
                  {item.customer_name} · {formatDate(item.created_at)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.amount}>{formatCurrency(item.grand_total)}</Text>
                <View style={s.payBadge}>
                  <Text style={s.payText}>{item.payment_method}</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  searchWrap: { padding: spacing.lg, paddingBottom: spacing.sm },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceTertiary,
  },
  searchInput: { flex: 1, fontSize: 17, color: colors.onSurface },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  invNo: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  meta: { fontSize: 14, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  payBadge: { marginTop: 4, backgroundColor: colors.brandTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  payText: { fontSize: 12, fontWeight: "700", color: colors.onBrandTertiary },
}));
