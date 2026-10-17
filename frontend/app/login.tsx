import { useState } from "react";
import { Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { BrandMark } from "@/src/components/brand";
import { Button, Field, Header, PhoneField, Screen, T } from "@/src/components/ui";
import { normalizePhone } from "@/src/format";
import { googleAvailable, signInWithGoogle } from "@/src/google";
import { colors, spacing } from "@/src/theme";
import { resetTo } from "@/src/nav";

export default function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { login, googleLogin } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await login(phone, password);
      resetTo(router, "/");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen bg={colors.surface}>
      <Header right={<View style={{ marginRight: 14 }}><BrandMark size={40} /></View>} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.xs, gap: 20 }} bottomOffset={24}>
        <View style={{ gap: spacing.xs }}>
          <T v="heading" style={{ fontSize: 36 }}>{t("Log in")}</T>
          <T v="body" color={colors.inkSoft}>{t("Owners and employees log in here.")}</T>
        </View>
        <PhoneField label={t("Phone number")} value={phone} onChangeText={setPhone} testID="login-phone" />
        <View style={{ gap: 6 }}>
          <Field label={t("Password or PIN")} value={password} onChangeText={setPassword} secureTextEntry={!show}
            autoCapitalize="none" testID="login-password" onSubmitEditing={submit} />
          <Pressable onPress={() => setShow(!show)} style={{ alignSelf: "flex-end", minHeight: 44, justifyContent: "center" }}>
            <T v="label" color={colors.green}>{show ? t("Hide") : t("Show")}</T>
          </Pressable>
        </View>
        <Button title={t("Log in")} icon="login" onPress={submit} loading={busy}
          disabled={!normalizePhone(phone) || !password} testID="login-submit" />
        {googleAvailable && (
          <Button title={t("Continue with Google (owners)")} icon="google" variant="outline"
            onPress={async () => {
              try {
                await googleLogin(await signInWithGoogle());
                resetTo(router, "/");
              } catch (e: any) {
                toast.show(e.message, "error");
              }
            }} />
        )}
        <View style={{ padding: spacing.lg, borderRadius: 14, backgroundColor: colors.page, gap: 6 }}>
          <T v="small" style={{ color: colors.inkSoft }}>
            {t("Forgot your password? Employees can ask the shop owner to set a new PIN. Owners can sign in with Google if they used it, or contact support.")}
          </T>
        </View>
        <Pressable onPress={() => router.replace("/signup")} style={{ minHeight: 52, alignItems: "center", justifyContent: "center" }}>
          <T v="bold" color={colors.green}>{t("New shop? Create an account")}</T>
        </Pressable>
      </KeyboardAwareScrollView>
    </Screen>
  );
}
