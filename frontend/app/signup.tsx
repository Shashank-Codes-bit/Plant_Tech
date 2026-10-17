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
import { colors, spacing } from "@/src/theme";
import { resetTo } from "@/src/nav";

export default function Signup() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = name.trim() && normalizePhone(phone) && password.length >= 8;

  async function submit() {
    setBusy(true);
    try {
      await register(name.trim(), phone, password);
      resetTo(router, "/setup/shop");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen bg={colors.surface}>
      <Header right={<View style={{ marginRight: 14 }}><BrandMark size={40} /></View>} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.xs, gap: spacing.lg }} bottomOffset={24}>
        <View style={{ gap: spacing.xs }}>
          <T v="heading">{t("Create your account")}</T>
          <T v="body" color={colors.inkSoft}>{t("You are the owner. You can add employees later.")}</T>
        </View>
        <Field label={t("Your name")} value={name} onChangeText={setName} autoCapitalize="words" testID="signup-name" />
        <PhoneField label={t("Phone number")} value={phone} onChangeText={setPhone} testID="signup-phone" />
        <Field label={t("Create a password")} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none"
          hint={t("At least 8 characters")} testID="signup-password" />
        <Button title={t("Create account")} icon="arrow-right" onPress={submit} loading={busy} disabled={!ok} testID="signup-submit" />
        <Pressable onPress={() => router.replace("/login")} style={{ minHeight: 52, alignItems: "center", justifyContent: "center" }}>
          <T v="bold" color={colors.green}>{t("I already have an account")}</T>
        </Pressable>
      </KeyboardAwareScrollView>
    </Screen>
  );
}
