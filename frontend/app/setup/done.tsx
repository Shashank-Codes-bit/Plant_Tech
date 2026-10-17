import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { apiPut } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { Button, Icon, IconName, Screen, T } from "@/src/components/ui";
import { colors, radius, spacing } from "@/src/theme";
import { resetTo } from "@/src/nav";

function Option({ icon, title, subtitle, onPress, disabled, testID }: {
  icon: IconName; title: string; subtitle: string; onPress: () => void; disabled?: boolean; testID?: string;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled} accessibilityState={{ disabled }}
      style={{ flexDirection: "row", alignItems: "center", gap: 16, padding: 14, minHeight: 80, borderRadius: radius.lg, borderWidth: 2,
        borderColor: colors.lineStrong, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={30} color={colors.green} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="bodyLarge">{title}</T>
        <T v="small">{subtitle}</T>
      </View>
    </Pressable>
  );
}

export default function SetupDone() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { user, refresh } = useAuth();
  const [state, setState] = useState<"saving" | "saved" | "failed">("saving");
  const saved = state === "saved";

  // Every choice below waits for this: until the shop is marked set up, the tabs send owners back to setup.
  const save = async (): Promise<"saved" | "failed"> => {
    try {
      await apiPut("/business", { onboarding_done: true });
      const u = await refresh();
      if (!u?.business?.onboarding_done) throw new Error(t("Your shop could not be saved. Please try again."));
      return "saved";
    } catch (e: any) {
      toast.show(e.message, "error");
      return "failed";
    }
  };

  useEffect(() => {
    (async () => setState(await save()))();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = async () => {
    setState("saving");
    setState(await save());
  };

  const go = (href: Href, then?: Href) => resetTo(router, href, then);

  return (
    <Screen bg={colors.surface}>
      <View style={{ alignItems: "center", gap: 12, paddingHorizontal: spacing.xl, paddingTop: spacing["2xl"] }}>
        <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" }}>
          <Icon name="check-bold" size={58} color={colors.white} />
        </View>
        <T v="heading" style={{ textAlign: "center" }}>{t("{{shop}} is ready", { shop: user?.business?.name || t("Your shop") })}</T>
        <T v="body" color={colors.inkSoft}>{t("What would you like to do first?")}</T>
      </View>
      <View style={{ flex: 1, gap: 12, padding: spacing.xl }}>
        <Option icon="sprout" title={t("Add my products")} subtitle={t("Type a name or take a photo")} testID="setup-add-products"
          disabled={!saved} onPress={() => go("/(tabs)/products", "/products/new")} />
        <Option icon="account-plus" title={t("Add an employee")} subtitle={t("Give each employee their own login")}
          disabled={!saved} onPress={() => go("/(tabs)", "/more/staff-edit")} />
        {state === "saving" && <T v="small" color={colors.muted} style={{ textAlign: "center" }}>{t("Saving your shop")}</T>}
        <View style={{ flex: 1 }} />
        {state === "failed" && <Button title={t("Try again")} icon="refresh" variant="outline" onPress={retry} testID="setup-retry" />}
        <Button title={t("Start selling")} icon="cart" onPress={() => go("/(tabs)")} disabled={!saved} testID="setup-start" />
      </View>
    </Screen>
  );
}
