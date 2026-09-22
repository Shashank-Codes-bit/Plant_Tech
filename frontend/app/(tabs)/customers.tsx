import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/src/api";
import { formatCurrency } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, Icon, LoadingView } from "@/src/components/ui";

export default function Customers() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const customers = useQuery({
    queryKey: ["customers", search],
    queryFn: () => apiGet(`/customers?search=${encodeURIComponent(search)}`),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={s.title}>Customers</Text>
        <View style={s.searchBox}>
          <Icon name="magnify" size={22} color={colors.muted} />
          <TextInput
            testID="customers-search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or phone"
            placeholderTextColor={colors.muted}
            style={s.searchInput}
          />
        </View>
      </View>

      {customers.isLoading ? (
        <LoadingView />
      ) : (customers.data ?? []).length === 0 ? (
        <EmptyState icon="account-group" title="No customers yet" subtitle="Add a customer or bill a walk-in." />
      ) : (
        <FlatList
          data={customers.data}
          keyExtractor={(c: any) => c.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.sm }}
          renderItem={({ item }) => (
            <Pressable
              testID={`customer-item-${item.id}`}
              style={s.row}
              onPress={() => router.push(`/customer/${item.id}`)}
            >
              <View style={s.avatar}>
                <Text style={s.avatarText}>{item.name?.[0]?.toUpperCase() ?? "?"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>
                  {item.name}
                </Text>
                {!!item.phone && <Text style={s.phone}>{item.phone}</Text>}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.total}>{formatCurrency(item.total_purchases)}</Text>
                <Text style={s.count}>{item.purchase_count} bills</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <Pressable testID="customers-add-fab" style={s.fab} onPress={() => router.push("/customer/new")}>
        <Icon name="account-plus" size={24} color={colors.onBrandPrimary} />
        <Text style={s.fabText}>Add</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: {
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing.md,
  },
  title: { fontSize: 28, fontWeight: "800", color: colors.onSurface, paddingHorizontal: spacing.lg },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing.lg,
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
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "800", color: colors.brandPrimary },
  name: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  phone: { fontSize: 15, color: colors.muted, marginTop: 2 },
  total: { fontSize: 17, fontWeight: "800", color: colors.brandPrimary },
  count: { fontSize: 13, color: colors.muted },

  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 56,
    paddingHorizontal: 20,
    borderRadius: 28,
    backgroundColor: colors.brandPrimary,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { color: colors.onBrandPrimary, fontSize: 17, fontWeight: "800" },
}));
