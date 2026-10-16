import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet } from "@/src/api";
import { Badge, BottomBar, Button, EmptyState, ErrorView, Header, LoadingView, Row, Screen, T } from "@/src/components/ui";
import { formatPhone } from "@/src/format";
import { useRefreshOnFocus } from "@/src/hooks/useRefreshOnFocus";
import { colors, spacing } from "@/src/theme";
import type { Worker } from "@/src/types";

export default function Staff() {
  const { t } = useTranslation();
  const router = useRouter();
  const q = useQuery<Worker[]>({ queryKey: ["staff"], queryFn: () => apiGet("/staff") });
  useRefreshOnFocus(q.refetch);
  const labels = { sell: t("Billing"), stock: t("Add stock"), customers: t("Customers"), reports: t("Reports") };

  return (
    <Screen bg={colors.surface}>
      <Header title={t("Staff")} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 10 }}>
        <T v="body" color={colors.inkSoft}>{t("Workers log in with their phone number and the PIN you set.")}</T>
        {q.isLoading ? <LoadingView /> : q.isError ? <ErrorView message={(q.error as Error).message} onRetry={q.refetch} />
          : !q.data?.length ? <EmptyState icon="account-multiple-plus" title={t("No workers yet")} subtitle={t("Add a worker so they can make bills on their own phone.")} />
          : q.data.map((w) => (
            <View key={w.id} style={{ gap: 6 }}>
              <Row title={w.name} chevron testID={`staff-${w.name}`}
                subtitle={`${formatPhone(w.phone)} · ${w.active ? t("active") : t("switched off")}`}
                left={<View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: w.active ? colors.greenTint : colors.page,
                  alignItems: "center", justifyContent: "center" }}><T v="number" color={w.active ? colors.greenDark : colors.muted}>{w.name.charAt(0).toUpperCase()}</T></View>}
                onPress={() => router.push({ pathname: "/more/staff-edit", params: { id: w.id } })} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingLeft: 4 }}>
                {(Object.keys(labels) as (keyof typeof labels)[]).filter((p) => w.permissions[p]).map((p) => (
                  <Badge key={p} text={labels[p]} tone={w.active ? "green" : "grey"} />
                ))}
              </View>
            </View>
          ))}
      </ScrollView>
      <BottomBar>
        <Button title={t("Add worker")} icon="account-plus" onPress={() => router.push("/more/staff-edit")} testID="staff-add" />
      </BottomBar>
    </Screen>
  );
}
