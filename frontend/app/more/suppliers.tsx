// Suppliers: everyone the shop buys from, made automatically from supplier bills or added here.
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet } from "@/src/api";
import { SupplierForm } from "@/src/components/supplier-form";
import { Button, EmptyState, ErrorView, Header, Icon, LoadingView, Screen, SearchBox, T } from "@/src/components/ui";
import { formatCurrency, formatPhone, plural } from "@/src/format";
import { useRefreshOnFocus } from "@/src/hooks/useRefreshOnFocus";
import { colors, radius, spacing } from "@/src/theme";
import type { Supplier } from "@/src/types";

export default function Suppliers() {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const q = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => apiGet("/suppliers") });
  useRefreshOnFocus(q.refetch);
  const s = search.trim().toLowerCase();
  const digits = s.replace(/\D/g, "");
  const shown = (q.data ?? []).filter((x) => !s || x.name.toLowerCase().includes(s) || (digits.length >= 3 && x.phone.replace(/\D/g, "").includes(digits))
    || x.gstin.toLowerCase().includes(s));

  return (
    <Screen>
      <Header title={t("Suppliers")} right={<Button title={t("Add")} icon="plus" size="md" onPress={() => setAdding(true)} testID="suppliers-add" />} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <SearchBox value={search} onChangeText={setSearch} placeholder={t("Name, phone or GST number")} testID="suppliers-search" />
      </View>
      {q.isLoading ? <LoadingView /> : q.isError ? <ErrorView message={(q.error as Error).message} onRetry={q.refetch} /> : (
        <FlatList
          data={shown}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.green} />}
          ListEmptyComponent={<EmptyState icon="truck-outline" title={q.data?.length ? t("Nothing matches") : t("No suppliers yet")}
            subtitle={q.data?.length ? undefined : t("Suppliers are saved from supplier bills, or you can add them here.")} />}
          renderItem={({ item: x }) => (
            <Pressable testID={`supplier-row-${x.name}`} onPress={() => router.push({ pathname: "/suppliers/[id]", params: { id: x.id } })}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, minHeight: 72, borderRadius: radius.lg,
                backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.blueTint, alignItems: "center", justifyContent: "center" }}>
                <Icon name="truck-outline" size={24} color={colors.blue} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="bold">{x.name}</T>
                <T v="small">{[formatPhone(x.phone), x.gstin].filter(Boolean).join(" · ") || t("No phone")}</T>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <T v="bold">{formatCurrency(x.total)}</T>
                <T v="caption">{plural(x.bills, "1 bill", "{{n}} bills")}</T>
              </View>
            </Pressable>
          )}
        />
      )}
      <SupplierForm visible={adding} onClose={() => setAdding(false)}
        onSaved={(x) => router.push({ pathname: "/suppliers/[id]", params: { id: x.id } })} />
    </Screen>
  );
}
