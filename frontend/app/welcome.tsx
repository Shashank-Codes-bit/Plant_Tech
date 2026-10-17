import { Pressable, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { Button, Icon, Screen, T } from "@/src/components/ui";
import { BrandIcon, BrandName } from "@/src/components/brand";
import { googleAvailable, signInWithGoogle } from "@/src/google";
import { colors, radius, spacing } from "@/src/theme";
import { resetTo } from "@/src/nav";

export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { googleLogin, ready, user } = useAuth();

  async function google() {
    try {
      await googleLogin(await signInWithGoogle());
      resetTo(router, "/");
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  }

  if (ready && user) return <Redirect href="/" />;

  return (
    <Screen bg={colors.surface} edgeTop={false}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18, paddingHorizontal: 32, paddingTop: 60,
        backgroundColor: colors.greenTint, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 }}>
        <BrandIcon size={112} />
        <BrandName big />
        <T v="bodyLarge" style={{ textAlign: "center", color: colors.green }}>हर पौधे का हिसाब</T>
        <T v="body" style={{ fontSize: 19, lineHeight: 26, textAlign: "center", color: colors.inkSoft }}>
          {t("Bills, stock and customers for your nursery, in one app.")}
        </T>
      </View>

      <View style={{ gap: 14, padding: spacing.xl }}>
        {googleAvailable && (
          <Button title={t("Continue with Google")} icon="google" variant="outline" onPress={google} testID="welcome-google" />
        )}
        <Button title={t("Sign up with phone number")} icon="cellphone" onPress={() => router.push("/signup")} testID="welcome-signup" />
        <Pressable onPress={() => router.push("/login")} testID="welcome-login"
          style={{ minHeight: 56, alignItems: "center", justifyContent: "center" }}>
          <T v="bold" color={colors.green}>{t("Already have an account? Log in")}</T>
        </Pressable>
        <Pressable onPress={() => router.push("/login")}
          style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 14, borderRadius: radius.md, backgroundColor: colors.page }}>
          <Icon name="account-hard-hat" size={26} color={colors.inkSoft} />
          <T v="small" style={{ flex: 1, color: colors.inkSoft }}>
            {t("Employees: log in with the phone number and PIN provided by the shop owner.")}
          </T>
        </Pressable>
      </View>
    </Screen>
  );
}
