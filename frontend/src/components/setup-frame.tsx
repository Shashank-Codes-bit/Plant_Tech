// Shared frame for the 5 setup steps: progress bar, title, content, Back / Next pinned at the bottom.
import React from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { BottomBar, Button, Screen, T } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";

export function SetupFrame({ step, title, subtitle, children, onNext, nextTitle, nextDisabled, busy, back = true }: {
  step: number; title: string; subtitle?: string; children: React.ReactNode; onNext: () => void;
  nextTitle?: string; nextDisabled?: boolean; busy?: boolean; back?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen bg={colors.surface}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <T v="label" color={colors.green}>{t("Set up your shop")}</T>
          <T v="label" color={colors.green}>{t("Step {{n}} of 5", { n: step })}</T>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i <= step ? colors.green : colors.line }} />
          ))}
        </View>
      </View>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} bottomOffset={24}>
        <View style={{ gap: spacing.xs }}>
          <T v="heading">{title}</T>
          {!!subtitle && <T v="body" color={colors.inkSoft}>{subtitle}</T>}
        </View>
        {children}
      </KeyboardAwareScrollView>
      <BottomBar style={{ flexDirection: "row", borderTopWidth: 0 }}>
        {back && step > 1 && (
          <Button title={t("Back")} icon="chevron-left" variant="outline" style={{ width: 130 }} onPress={() => router.back()} />
        )}
        <Button title={nextTitle ?? t("Next")} icon="arrow-right" style={{ flex: 1 }} onPress={onNext}
          disabled={nextDisabled} loading={busy} testID={`setup-next-${step}`} />
      </BottomBar>
    </Screen>
  );
}
