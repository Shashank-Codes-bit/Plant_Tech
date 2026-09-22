import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";

import { apiGet, fileUrl } from "@/src/api";
import { formatCurrency } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, Icon, LoadingView, StockBadge } from "@/src/components/ui";
import { Header } from "@/src/components/header";
import { useCart } from "@/src/cart-context";
import { useToast } from "@/src/components/toast";

export default function Search() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { addItem, count, items } = useCart();
  const [search, setSearch] = useState("");

  const products = useQuery({ queryKey: ["products"], queryFn: () => apiGet("/products") });

  const filtered = useMemo(() => {
    const list = products.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p: any) =>
        p.name.toLowerCase().includes(q) ||
        (p.botanical_name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q),
    );
  }, [products.data, search]);

  function add(p: any) {
    if (p.stock <= 0) {
      toast.show(`${p.name} is out of stock`, "error");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    addItem({
      product_id: p.id,
      name: p.name,
      price: p.selling_price,
      quantity: 1,
      photo_path: p.photo_path,
      botanical_name: p.botanical_name,
      stock: p.stock,
    });
    toast.show(`${p.name} added`, "success");
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Add Product" />
      <View style={s.searchWrap}>
        <View style={s.searchBox}>
          <Icon name="magnify" size={22} color={colors.muted} />
          <TextInput
            testID="search-input"
            value={search}
            onChangeText={setSearch}
            placeholder="Search products"
            placeholderTextColor={colors.muted}
            style={s.searchInput}
            autoFocus
          />
        </View>
      </View>

      {products.isLoading ? (
        <LoadingView />
      ) : filtered.length === 0 ? (
        <EmptyState icon="magnify" title="No products found" subtitle="Try another name or category." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p: any) => p.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.sm }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const inCart = items.find((i) => i.product_id === item.id);
            return (
              <View style={s.row} testID={`search-item-${item.id}`}>
                <View style={s.thumb}>
                  {item.photo_path ? (
                    <Image source={{ uri: fileUrl(item.photo_path) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <Icon name="leaf" size={24} color={colors.brandPrimary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={s.price}>{formatCurrency(item.selling_price)}</Text>
                  <StockBadge stock={item.stock} min={item.min_stock} />
                </View>
                <Pressable
                  testID={`search-add-${item.id}`}
                  style={[s.addBtn, inCart && s.addBtnActive]}
                  onPress={() => add(item)}
                >
                  <Icon name={inCart ? "check" : "plus"} size={24} color={colors.onBrandPrimary} />
                  {inCart && <Text style={s.addBtnCount}>{inCart.quantity}</Text>}
                </Pressable>
              </View>
            );
          }}
        />
      )}

      {count > 0 && (
        <Pressable
          testID="search-view-cart"
          style={[s.cartBar, { paddingBottom: insets.bottom + spacing.md }]}
          onPress={() => router.replace("/(tabs)/billing")}
        >
          <Icon name="cart" size={24} color={colors.onBrandPrimary} />
          <Text style={s.cartBarText}>View Cart ({count})</Text>
          <Icon name="arrow-right" size={24} color={colors.onBrandPrimary} />
        </Pressable>
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
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  name: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  price: { fontSize: 16, fontWeight: "700", color: colors.brandPrimary, marginVertical: 2 },
  addBtn: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 2,
  },
  addBtnActive: { backgroundColor: colors.success },
  addBtnCount: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 },

  cartBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: spacing.md,
    backgroundColor: colors.brandPrimary,
  },
  cartBarText: { color: colors.onBrandPrimary, fontSize: 19, fontWeight: "800" },
}));
