import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { apiPut } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { Button, Icon, IconName, Screen, T } from "@/src/components/ui";
import { colors, radius, spacing } from "@/src/theme";
import { resetTo } from "@/src/nav";

function Option({ icon, title, subtitle, onPress, testID }: { icon: IconName; title: string; subtitle: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 16, padding: 14, minHeight: 80, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.lineStrong }}>
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
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await apiPut("/business", { onboarding_done: true });
        await refresh();
        setSaved(true);
      } catch (e: any) {
        toast.show(e.message, "error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (href: any) => resetTo(router, href);

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
          onPress={() => { go("/(tabs)/products"); setTimeout(() => router.push("/products/new"), 50); }} />
        <Option icon="account-plus" title={t("Add an employee")} subtitle={t("Give each employee their own login")}
          onPress={() => { go("/(tabs)"); setTimeout(() => router.push("/more/staff-edit"), 50); }} />
        <View style={{ flex: 1 }} />
        <Button title={t("Start selling")} icon="cart" onPress={() => go("/(tabs)")} disabled={!saved} testID="setup-start" />
      </View>
    </Screen>
  );
}
