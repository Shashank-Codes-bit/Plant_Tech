// One product: price, stock, add or remove stock, and what happened to its stock.
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet, apiPost } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { Badge, Button, ErrorView, Header, Icon, LoadingView, Screen, Segmented, Stepper, T, Thumb } from "@/src/components/ui";
import { formatCurrency, formatDate, formatQty } from "@/src/format";
import { colors, radius, spacing } from "@/src/theme";
import type { Product, StockEntry } from "@/src/types";

export default function ProductDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { can, isOwner } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery<Product & { history: StockEntry[] }>({ queryKey: ["product", id], queryFn: () => apiGet(`/products/${id}`) });
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [n, setN] = useState(1);
  const [busy, setBusy] = useState(false);
  const p = q.data;

  async function change() {
    setBusy(true);
    try {
      await apiPost(`/products/${id}/stock`, { change: mode === "add" ? n : -n, reason: mode === "add" ? "Added" : "Removed (damaged or lost)" });
      await Promise.all([q.refetch(), qc.invalidateQueries({ queryKey: ["products"] })]);
      toast.show(mode === "add" ? t("Added {{n}}", { n }) : t("Removed {{n}}", { n }), "success");
      setN(1);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const what = (h: StockEntry) =>
    h.type === "initial" ? t("Opening stock") : h.type === "sale" ? t("Sold") : h.type === "purchase" ? t("Supplier bill")
      : h.change > 0 ? t("Added") : t("Removed");

  return (
    <Screen bg={colors.surface}>
      <Header title={t("Product")} right={p && can("stock") ? (
        <Button title={t("Edit")} icon="pencil" variant="outline" size="md" style={{ marginRight: 8 }}
          onPress={() => router.push({ pathname: "/products/edit", params: { id } })} testID="product-edit" />
      ) : undefined} />
      {!p ? (q.isError ? <ErrorView message={(q.error as Error).message} onRetry={q.refetch} /> : <LoadingView />) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            <Thumb path={p.image_path} size={112} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="title" testID="product-title">{p.name}</T>
              <T v="small">{[p.category || t("No category"), p.gst_percent ? t("{{n}}% GST", { n: p.gst_percent }) : ""].filter(Boolean).join(" · ")}</T>
              {p.image_source === "library" && <T v="caption">{t("Shared picture · tap Edit to use your own")}</T>}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, padding: 14, borderRadius: radius.lg, backgroundColor: colors.page, gap: 2 }}>
              <T v="label">{p.gst_percent ? t("Price (incl. GST)") : t("Price")}</T>
              <T v="title">{formatCurrency(p.selling_price)}</T>
              {isOwner && p.cost_price != null && p.cost_price > 0 && (
                <T v="caption">{t("Cost {{c}} · only you see this", { c: formatCurrency(p.cost_price) })}</T>
              )}
            </View>
            <View style={{ flex: 1, padding: 14, borderRadius: radius.lg, backgroundColor: p.out_of_stock ? "#FDECEC" : p.low_stock ? colors.amberTint : colors.page, gap: 2 }}>
              <T v="label">{t("In stock")}</T>
              <T v="title" testID="product-stock" color={p.out_of_stock ? colors.red : colors.ink}>{formatQty(p.stock)}</T>
              {p.out_of_stock ? <Badge text={t("Out of stock")} tone="red" />
                : p.low_stock ? <T v="caption" color={colors.amberInk}>{t("Low: alert below {{n}}", { n: formatQty(p.min_stock) })}</T> : null}
            </View>
          </View>

          {can("stock") && (
            <View style={{ gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.line }}>
              <Segmented value={mode} onChange={(m) => { setMode(m); setN(1); }}
                options={[{ value: "add", label: t("Add stock") }, { value: "remove", label: t("Remove") }]} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Stepper value={n} onChange={setN} max={mode === "remove" ? Math.max(1, p.stock) : 9999} testID="stock-n" />
                <Button title={mode === "add" ? t("Add {{n}}", { n }) : t("Remove {{n}}", { n })} icon={mode === "add" ? "plus" : "minus"}
                  variant={mode === "add" ? "primary" : "danger"} size="md" style={{ flex: 1 }} onPress={change} loading={busy}
                  disabled={mode === "remove" && p.stock < n} testID="stock-apply" />
              </View>
              {mode === "remove" && <T v="small">{t("For plants that died, broke or went missing.")}</T>}
            </View>
          )}

          {p.history.length > 0 && (
            <View style={{ gap: 6 }}>
              <T v="label" style={{ fontSize: 18 }}>{t("History")}</T>
              {p.history.map((h) => (
                <View key={h.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                  <View style={{ flex: 1 }}>
                    <T v="bold">{what(h)}</T>
                    <T v="small">{[formatDate(h.created_at), h.by?.name].filter(Boolean).join(" · ")}</T>
                  </View>
                  <T v="number" color={h.change > 0 ? colors.green : colors.red}>{h.change > 0 ? "+" : ""}{formatQty(h.change)}</T>
                </View>
              ))}
            </View>
          )}

          {can("sell") && (
            <Pressable onPress={() => router.push("/order/scan")} style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", minHeight: 52 }}>
              <Icon name="cart-plus" size={22} color={colors.green} />
              <T v="bold" color={colors.green}>{t("New order")}</T>
            </Pressable>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
