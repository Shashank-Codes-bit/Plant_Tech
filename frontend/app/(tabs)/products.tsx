// Products: search plus Category, Stock and Sort filters. A product stays here at 0 stock
// (marked Out of stock) until the owner deletes it.
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useCategories } from "@/src/components/category-picker";
import { FilterChip, OptionRow, Sheet } from "@/src/components/sheet";
import { Badge, BottomBar, Button, EmptyState, ErrorView, Icon, LoadingView, Screen, T, Thumb } from "@/src/components/ui";
import { formatCurrency, formatQty } from "@/src/format";
import { useRefreshOnFocus } from "@/src/hooks/useRefreshOnFocus";
import { colors, fonts, radius, spacing } from "@/src/theme";
import type { Product } from "@/src/types";

type StockFilter = "" | "in" | "low" | "out";
type Sort = "name" | "price-up" | "price-down" | "stock-up" | "new";

export default function Products() {
  const { t } = useTranslation();
  const router = useRouter();
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState<StockFilter>("");
  const [sort, setSort] = useState<Sort>("name");
  const [sheet, setSheet] = useState<"" | "category" | "stock" | "sort">("");
  const q = useQuery<Product[]>({ queryKey: ["products"], queryFn: () => apiGet("/products") });
  const cats = useCategories();
  useRefreshOnFocus(q.refetch);

  const all = useMemo(() => q.data ?? [], [q.data]);
  const counts = {
    low: all.filter((p) => p.low_stock && !p.out_of_stock).length,
    out: all.filter((p) => p.out_of_stock).length,
  };
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = all.filter((p) =>
      (!s || p.name.toLowerCase().includes(s) || p.botanical_name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s))
      && (!category || p.category_id === category)
      && (stock === "" || (stock === "in" && !p.low_stock) || (stock === "low" && p.low_stock && !p.out_of_stock) || (stock === "out" && p.out_of_stock)));
    const by: Record<Sort, (a: Product, b: Product) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      "price-up": (a, b) => a.selling_price - b.selling_price,
      "price-down": (a, b) => b.selling_price - a.selling_price,
      "stock-up": (a, b) => a.stock - b.stock,
      new: (a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    };
    return [...list].sort(by[sort]);
  }, [all, search, category, stock, sort]);

  const STOCK: { v: StockFilter; label: string; sub?: string }[] = [
    { v: "", label: t("All stock") },
    { v: "in", label: t("In stock"), sub: t("Above the alert level") },
    { v: "low", label: t("Low stock · {{n}}", { n: counts.low }), sub: t("At or below the low-stock alert level") },
    { v: "out", label: t("Out of stock · {{n}}", { n: counts.out }) },
  ];
  const SORTS: { v: Sort; label: string }[] = [
    { v: "name", label: t("Name A–Z") }, { v: "price-up", label: t("Price: low to high") }, { v: "price-down", label: t("Price: high to low") },
    { v: "stock-up", label: t("Stock: lowest first") }, { v: "new", label: t("Newest first") },
  ];
  const catName = cats.data?.find((c) => c.id === category)?.name ?? "";
  const filtered = !!(search || category || stock);

  return (
    <Screen edgeBottom={false}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 10, gap: 10, backgroundColor: colors.surface,
        borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <T v="title">{t("Products")}</T>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 14, borderWidth: 2,
          borderColor: search ? colors.green : colors.lineStrong, borderRadius: 16 }}>
          <Icon name="magnify" size={24} color={colors.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder={t("Search name or code")} placeholderTextColor={colors.muted}
            testID="products-search" style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 18, color: colors.ink, minHeight: 48 }} />
          {!!search && (
            <Pressable accessibilityLabel={t("Clear")} onPress={() => setSearch("")} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <Icon name="close-circle" size={22} color={colors.muted} />
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChip label={t("Category")} value={catName} icon="shape-outline" onPress={() => setSheet("category")} testID="products-filter-category" />
          <FilterChip label={t("Stock")} value={stock ? STOCK.find((x) => x.v === stock)!.label : ""} icon="package-variant"
            onPress={() => setSheet("stock")} testID="products-filter-stock" />
          <FilterChip label={t("Sort")} value={sort !== "name" ? SORTS.find((x) => x.v === sort)!.label : ""} icon="sort"
            onPress={() => setSheet("sort")} testID="products-filter-sort" />
          {filtered && (
            <Pressable onPress={() => { setSearch(""); setCategory(""); setStock(""); }} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 10 }}>
              <T v="bold" color={colors.red}>{t("Clear all")}</T>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {q.isLoading ? <LoadingView /> : q.isError ? <ErrorView message={(q.error as Error).message} onRetry={q.refetch} /> : (
        <FlatList
          data={shown}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.lg, gap: 8 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.green} />}
          ListHeaderComponent={all.length ? (
            <T v="label" style={{ paddingBottom: 2 }} testID="products-count">
              {filtered ? t("{{n}} of {{all}} products", { n: shown.length, all: all.length })
                : t("{{all}} products · {{low}} low · {{out}} out of stock", { all: all.length, low: counts.low, out: counts.out })}
            </T>
          ) : null}
          ListEmptyComponent={
            <EmptyState icon="sprout" title={all.length ? t("Nothing matches") : t("No products yet")}
              subtitle={all.length ? t("Try different filters, or tap Clear all.") : t("Add the plants, pots and other items you sell.")} />
          }
          renderItem={({ item: p }) => (
            <Pressable testID={`product-${p.name}`} onPress={() => router.push({ pathname: "/products/[id]", params: { id: p.id } })}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, minHeight: 76, borderRadius: radius.lg,
                backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}>
              <Thumb path={p.image_path} size={56} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <T v="bold">{p.name}</T>
                <T v="small">{[formatCurrency(p.selling_price), p.category].filter(Boolean).join(" · ")}</T>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                {p.out_of_stock ? <Badge text={t("Out of stock")} tone="red" />
                  : p.low_stock ? <Badge text={t("Low · {{n}}", { n: formatQty(p.stock) })} tone="amber" />
                  : <><T v="number">{formatQty(p.stock)}</T><T v="caption">{t("in stock")}</T></>}
              </View>
            </Pressable>
          )}
        />
      )}

      {can("stock") && (
        <BottomBar style={{ flexDirection: "row" }}>
          <Button title={t("Add product")} icon="plus" size="md" style={{ flex: 1, paddingHorizontal: 10 }} onPress={() => router.push("/products/new")} testID="products-add" />
          <Button title={t("Supplier bill")} icon="file-document-outline" variant="scan" size="md" style={{ flex: 1, paddingHorizontal: 10 }}
            onPress={() => router.push("/more/supplier-bill")} testID="products-supplier-bill" />
        </BottomBar>
      )}

      <Sheet visible={sheet === "category"} onClose={() => setSheet("")} title={t("Category")}>
        <OptionRow label={t("All categories")} selected={!category} onPress={() => { setCategory(""); setSheet(""); }} />
        {(cats.data ?? []).map((c) => (
          <OptionRow key={c.id} label={c.name} sub={c.product_count === 1 ? t("1 product") : t("{{n}} products", { n: c.product_count ?? 0 })}
            selected={category === c.id} onPress={() => { setCategory(c.id); setSheet(""); }} testID={`products-cat-${c.name}`} />
        ))}
      </Sheet>
      <Sheet visible={sheet === "stock"} onClose={() => setSheet("")} title={t("Stock")}>
        {STOCK.map((x) => (
          <OptionRow key={x.v || "all"} label={x.label} sub={x.sub} selected={stock === x.v} onPress={() => { setStock(x.v); setSheet(""); }}
            testID={`products-stock-${x.v || "all"}`} />
        ))}
      </Sheet>
      <Sheet visible={sheet === "sort"} onClose={() => setSheet("")} title={t("Sort")}>
        {SORTS.map((x) => (
          <OptionRow key={x.v} label={x.label} selected={sort === x.v} onPress={() => { setSort(x.v); setSheet(""); }} testID={`products-sort-${x.v}`} />
        ))}
      </Sheet>
    </Screen>
  );
}
