// Products: search, All / Low stock, Add product, Supplier bill.
// A product stays here at 0 stock (marked Out of stock) until the owner deletes it.
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Badge, BottomBar, Button, Chip, EmptyState, ErrorView, Icon, LoadingView, Screen, T, Thumb } from "@/src/components/ui";
import { formatCurrency, formatQty } from "@/src/format";
import { useRefreshOnFocus } from "@/src/hooks/useRefreshOnFocus";
import { colors, fonts, radius, spacing } from "@/src/theme";
import type { Product } from "@/src/types";

export default function Products() {
  const { t } = useTranslation();
  const router = useRouter();
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [low, setLow] = useState(false);
  const q = useQuery<Product[]>({ queryKey: ["products"], queryFn: () => apiGet("/products") });
  useRefreshOnFocus(q.refetch);

  const all = q.data ?? [];
  const lowCount = all.filter((p) => p.low_stock).length;
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((p) => (!low || p.low_stock) && (!s || p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s)));
  }, [all, search, low]);

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 12, gap: 10, backgroundColor: colors.surface }}>
        <T v="title">{t("Products")}</T>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingHorizontal: 14, borderWidth: 2,
          borderColor: colors.lineStrong, borderRadius: 16 }}>
          <Icon name="magnify" size={26} color={colors.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder={t("Search products")} placeholderTextColor={colors.muted}
            testID="products-search" style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 19, color: colors.ink, minHeight: 52 }} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip label={t("All · {{n}}", { n: all.length })} active={!low} onPress={() => setLow(false)} testID="products-all" />
          <Chip label={t("Low stock · {{n}}", { n: lowCount })} active={low} tone="amber" onPress={() => setLow(true)} testID="products-low" />
        </View>
      </View>

      {q.isLoading ? <LoadingView /> : q.isError ? <ErrorView message={(q.error as Error).message} onRetry={q.refetch} /> : (
        <FlatList
          data={shown}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.lg, gap: 8 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.green} />}
          ListEmptyComponent={
            <EmptyState icon="sprout" title={all.length ? t("Nothing matches") : t("No products yet")}
              subtitle={all.length ? undefined : t("Add the plants, pots and other things you sell.")} />
          }
          renderItem={({ item: p }) => (
            <Pressable testID={`product-${p.name}`} onPress={() => router.push({ pathname: "/products/[id]", params: { id: p.id } })}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, minHeight: 76, borderRadius: radius.lg,
                backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}>
              <Thumb path={p.image_path} size={56} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <T v="bold" numberOfLines={1}>{p.name}</T>
                <T v="small" numberOfLines={1}>{[formatCurrency(p.selling_price), p.category].filter(Boolean).join(" · ")}</T>
              </View>
              {p.out_of_stock ? <Badge text={t("Out of stock")} tone="red" />
                : p.low_stock ? <Badge text={t("Only {{n}} left", { n: formatQty(p.stock) })} tone="amber" />
                : <T v="bold" color={colors.inkSoft}>{t("{{n}} left", { n: formatQty(p.stock) })}</T>}
            </Pressable>
          )}
        />
      )}

      {can("stock") && (
        <BottomBar style={{ flexDirection: "row" }}>
          <Button title={t("Add product")} icon="plus" size="md" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => router.push("/products/new")} testID="products-add" />
          <Button title={t("Supplier bill")} icon="file-document-outline" variant="scan" size="md" style={{ flex: 1, paddingHorizontal: 8 }}
            onPress={() => router.push("/more/supplier-bill")} testID="products-supplier-bill" />
        </BottomBar>
      )}
    </Screen>
  );
}
