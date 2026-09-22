import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";

import { apiGet, fileUrl } from "@/src/api";
import { formatCurrency } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, Icon, LoadingView, StockBadge } from "@/src/components/ui";

export default function Inventory() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const products = useQuery({ queryKey: ["products"], queryFn: () => apiGet("/products") });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => apiGet("/categories") });

  const filtered = useMemo(() => {
    let list = products.data ?? [];
    if (category) list = list.filter((p: any) => p.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p: any) =>
          p.name.toLowerCase().includes(q) ||
          (p.botanical_name || "").toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [products.data, search, category]);

  const chips = ["", ...(categories.data ?? []).map((c: any) => c.name)];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={s.title}>Inventory</Text>
        <View style={s.searchBox}>
          <Icon name="magnify" size={22} color={colors.muted} />
          <TextInput
            testID="inventory-search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, botanical, SKU"
            placeholderTextColor={colors.muted}
            style={s.searchInput}
          />
        </View>
        <FlatList
          data={chips}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(c) => c || "all"}
          style={s.chipRow}
          contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
          renderItem={({ item }) => {
            const active = category === item;
            return (
              <Pressable
                testID={`inventory-chip-${item || "all"}`}
                onPress={() => setCategory(item)}
                style={[s.chip, active && s.chipActive]}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{item || "All"}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {products.isLoading ? (
        <LoadingView />
      ) : filtered.length === 0 ? (
        <EmptyState icon="sprout" title="No products found" subtitle="Try a different search or add a product." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p: any) => p.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.sm }}
          renderItem={({ item }) => (
            <Pressable
              testID={`inventory-item-${item.id}`}
              style={s.row}
              onPress={() => router.push(`/product/${item.id}`)}
            >
              <View style={s.thumb}>
                {item.photo_path ? (
                  <Image source={{ uri: fileUrl(item.photo_path) }} style={s.thumbImg} contentFit="cover" />
                ) : (
                  <Icon name="leaf" size={26} color={colors.brandPrimary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>
                  {item.name}
                </Text>
                {!!item.botanical_name && (
                  <Text style={s.botanical} numberOfLines={1}>
                    {item.botanical_name}
                  </Text>
                )}
                <Text style={s.price}>{formatCurrency(item.selling_price)}</Text>
              </View>
              <StockBadge stock={item.stock} min={item.min_stock} />
            </Pressable>
          )}
        />
      )}

      <Pressable
        testID="inventory-add-fab"
        style={[s.fab, { bottom: spacing.xl }]}
        onPress={() => router.push("/product/new")}
      >
        <Icon name="plus" size={26} color={colors.onBrandPrimary} />
        <Text style={s.fabText}>Add</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: {
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
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
  chipRow: { maxHeight: 56 },
  chip: {
    height: 42,
    flexShrink: 0,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { fontSize: 15, fontWeight: "700", color: colors.onSurfaceTertiary },
  chipTextActive: { color: colors.onBrandPrimary },

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
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImg: { width: "100%", height: "100%" },
  name: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  botanical: { fontSize: 13, color: colors.muted, fontStyle: "italic" },
  price: { fontSize: 16, fontWeight: "700", color: colors.brandPrimary, marginTop: 2 },

  fab: {
    position: "absolute",
    right: spacing.lg,
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
