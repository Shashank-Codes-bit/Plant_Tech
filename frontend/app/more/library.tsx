// App admin: the shared product pictures every shop sees. A shop's first clear photo fills an empty
// one and shows as New until checked here.
import { useState } from "react";
import { FlatList, View } from "react-native";
import { Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiDelete, apiGet, apiPost } from "@/src/api";
import { useAuth } from "@/src/auth";
import { confirm } from "@/src/confirm";
import { useToast } from "@/src/components/toast";
import { Badge, Button, Chip, EmptyState, Header, LoadingView, Screen, T, Thumb } from "@/src/components/ui";
import { takePhoto } from "@/src/hooks/useImageCapture";
import { colors, radius, spacing } from "@/src/theme";
import type { LibraryEntry } from "@/src/types";

type Filter = "all" | "new" | "none" | "live";

export default function AdminLibrary() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery<LibraryEntry[]>({ queryKey: ["admin-library", filter], queryFn: () => apiGet(`/admin/library?status=${filter}`),
    enabled: !!user?.is_admin });
  if (!user?.is_admin) return <Redirect href="/(tabs)/more" />;

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    try {
      await fn();
      await q.refetch();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function photo(e: LibraryEntry) {
    const out = await takePhoto();
    if (out.status !== "ok") return;
    act(e.id, () => apiPost(`/admin/library/${e.id}/photo`, { image_base64: out.result.base64 }));
  }

  const FILTERS: { f: Filter; label: string }[] = [
    { f: "all", label: t("All") }, { f: "new", label: t("New, to check") }, { f: "none", label: t("No picture") }, { f: "live", label: t("Checked") },
  ];
  const status = (e: LibraryEntry) => e.image_status === "new" ? <Badge text={t("New")} tone="amber" />
    : e.image_status === "live" ? <Badge text={t("Checked")} tone="green" /> : <Badge text={t("No picture")} tone="grey" />;

  return (
    <Screen bg={colors.surface}>
      <Header title={t("Shared pictures")} right={<Badge text="ADMIN" tone="amber" />} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: spacing.lg, gap: 10 }}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <T v="small">{t("Every shop sees these pictures. A product without one gets the first clear photo a shop takes; it shows as New until you check it.")}</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {FILTERS.map(({ f, label }) => <Chip key={f} label={label} active={filter === f} onPress={() => setFilter(f)} />)}
            </View>
          </View>
        }
        ListEmptyComponent={q.isLoading ? <LoadingView /> : <EmptyState icon="image-multiple" title={t("Nothing here")} />}
        renderItem={({ item: e }) => (
          <View style={{ gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Thumb path={e.image_path} size={72} />
              <View style={{ flex: 1, gap: 4 }}>
                <T v="bold" numberOfLines={1}>{e.name}{e.name_hi ? ` · ${e.name_hi}` : ""}</T>
                <T v="small" numberOfLines={1}>{e.default_category}</T>
                {status(e)}
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title={e.image_path ? t("New photo") : t("Add photo")} icon="camera" variant="outline" size="md" style={{ flex: 1 }}
                onPress={() => photo(e)} loading={busy === e.id} />
              {e.image_status === "new" && (
                <Button title={t("Looks good")} icon="check" variant="secondary" size="md" style={{ flex: 1 }}
                  onPress={() => act(e.id, () => apiPost(`/admin/library/${e.id}/approve`))} />
              )}
              {!!e.image_path && (
                <Button title={t("Remove")} icon="image-remove" variant="danger" size="md" style={{ flex: 1 }}
                  onPress={async () => {
                    if (await confirm(t("Remove this picture?"), t("Shops stop seeing it. The next shop photo can fill it again."), t("Remove"), true)) {
                      act(e.id, () => apiDelete(`/admin/library/${e.id}/photo`));
                    }
                  }} />
              )}
            </View>
          </View>
        )}
      />
    </Screen>
  );
}
