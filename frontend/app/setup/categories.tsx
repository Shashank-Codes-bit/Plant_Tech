import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet, apiPost } from "@/src/api";
import { SetupFrame } from "@/src/components/setup-frame";
import { useToast } from "@/src/components/toast";
import { Chip, LoadingView, Screen, T } from "@/src/components/ui";
import { colors, fonts } from "@/src/theme";
import type { Business, Category } from "@/src/types";

type Suggestion = { name: string; gst_percent: number };
const DEFAULT_ON = ["Indoor Plants", "Outdoor Plants", "Flowering Plants", "Succulents", "Pots", "Soil", "Fertilizers"];

export default function SetupCategories() {
  const biz = useQuery<Business>({ queryKey: ["business"], queryFn: () => apiGet("/business") });
  const suggestions = useQuery<Suggestion[]>({ queryKey: ["category-suggestions"], queryFn: () => apiGet("/categories/suggestions") });
  const existing = useQuery<Category[]>({ queryKey: ["categories"], queryFn: () => apiGet("/categories") });
  if (!biz.data || !suggestions.data || !existing.data) return <Screen bg={colors.surface}><LoadingView /></Screen>;
  return <CategoriesStep gst={!!biz.data.gst_registered} suggestions={suggestions.data} existing={existing.data.map((c) => c.name)} />;
}

function CategoriesStep({ gst, suggestions, existing }: { gst: boolean; suggestions: Suggestion[]; existing: string[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState<Record<string, boolean>>(
    () => Object.fromEntries((existing.length ? existing : DEFAULT_ON).map((n) => [n, true])));
  const [busy, setBusy] = useState(false);
  const chosen = suggestions.filter((s) => on[s.name]);

  async function next() {
    setBusy(true);
    try {
      await apiPost("/categories/bulk", { items: chosen.map((s) => ({ name: s.name, gst_percent: gst ? s.gst_percent : 0 })) });
      router.push("/setup/done");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupFrame step={4} title={t("What do you sell?")} onNext={next} busy={busy} nextDisabled={!chosen.length}
      subtitle={t("Select the categories you sell. {{n}} selected", { n: chosen.length })}>
      {gst && (
        <T v="small" style={{ marginTop: -8 }}>
          {t("The percentage is the suggested GST rate for each category. Please confirm rates with your accountant; you can change them at any time.")}
        </T>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {suggestions.map((s) => (
          <Chip key={s.name} label={t(s.name)} active={!!on[s.name]} testID={`setup-cat-${s.name}`}
            onPress={() => setOn((o) => ({ ...o, [s.name]: !o[s.name] }))}
            right={gst ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 1, borderRadius: 10, backgroundColor: on[s.name] ? colors.greenMid : colors.page }}>
                <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: on[s.name] ? colors.white : colors.inkSoft }}>{s.gst_percent}%</Text>
              </View>
            ) : undefined} />
        ))}
      </View>
    </SetupFrame>
  );
}
