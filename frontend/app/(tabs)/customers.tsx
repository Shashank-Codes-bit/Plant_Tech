// Customers: saved automatically when a bill has a phone number, or added here.
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet } from "@/src/api";
import { Button, EmptyState, ErrorView, Icon, LoadingView, Screen, T } from "@/src/components/ui";
import { formatCurrency, formatPhone } from "@/src/format";
import { useRefreshOnFocus } from "@/src/hooks/useRefreshOnFocus";
import { colors, fonts, radius, spacing } from "@/src/theme";
import type { Customer } from "@/src/types";

export default function Customers() {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const q = useQuery<Customer[]>({ queryKey: ["customers"], queryFn: () => apiGet("/customers") });
  useRefreshOnFocus(q.refetch);
  const s = search.trim().toLowerCase();
  const digits = s.replace(/\D/g, "");
  const shown = (q.data ?? []).filter((c) => !s || c.name.toLowerCase().includes(s) || (digits.length >= 3 && c.phone.includes(digits)));

  return (
    <Screen edgeBottom={false}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 12, gap: 10, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <T v="title">{t("Customers")}</T>
          <Button title={t("Add")} icon="account-plus" size="md" onPress={() => router.push("/customers/new")} testID="customers-add" />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingHorizontal: 14, borderWidth: 2,
          borderColor: colors.lineStrong, borderRadius: 16 }}>
          <Icon name="magnify" size={26} color={colors.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder={t("Name or phone")} placeholderTextColor={colors.muted}
            testID="customers-search" style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 19, color: colors.ink, minHeight: 52 }} />
        </View>
      </View>
      {q.isLoading ? <LoadingView /> : q.isError ? <ErrorView message={(q.error as Error).message} onRetry={q.refetch} /> : (
        <FlatList
          data={shown}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.lg, gap: 8 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.green} />}
          ListEmptyComponent={<EmptyState icon="account-group" title={q.data?.length ? t("Nothing matches") : t("No customers yet")}
            subtitle={q.data?.length ? undefined : t("Customers are saved when you start a new order and will appear here.")} />}
          renderItem={({ item: c }) => (
            <Pressable testID={`customer-${c.name}`} onPress={() => router.push({ pathname: "/customers/[id]", params: { id: c.id } })}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, minHeight: 72, borderRadius: radius.lg,
                backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center" }}>
                <T v="number" color={colors.greenDark}>{c.name.charAt(0).toUpperCase()}</T>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="bold">{c.name}</T>
                <T v="small">{formatPhone(c.phone) || t("No phone")}</T>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <T v="bold">{formatCurrency(c.total_purchases)}</T>
                <T v="caption">{c.purchase_count === 1 ? t("1 visit") : t("{{n}} visits", { n: c.purchase_count })}</T>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
