import { useState } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTranslation } from "react-i18next";

import { apiPost } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { BottomBar, Button, Field, Header, PhoneField, Screen } from "@/src/components/ui";
import { normalizePhone } from "@/src/format";
import { colors, spacing } from "@/src/theme";

export default function NewCustomer() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const phone10 = normalizePhone(phone);
  const phoneBad = !!phone && !phone10;

  async function save() {
    setBusy(true);
    try {
      await apiPost("/customers", { name: name.trim(), phone: `+91${phone10}`, address, notes });
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.show(t("Saved"), "success");
      router.back();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen bg={colors.surface}>
      <Header title={t("Add customer")} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: 16 }} bottomOffset={24}>
        <Field label={t("Name")} value={name} onChangeText={setName} autoCapitalize="words" autoFocus testID="customer-name" />
        <PhoneField label={t("Phone (WhatsApp)")} value={phone} onChangeText={setPhone} testID="customer-phone"
          error={phoneBad && phone.length === 10 ? t("Enter a 10-digit mobile number") : undefined} />
        <Field label={t("Address (optional)")} value={address} onChangeText={setAddress} multiline />
        <Field label={t("Notes (optional)")} value={notes} onChangeText={setNotes} multiline placeholder={t("e.g. Likes flowering plants")} />
      </KeyboardAwareScrollView>
      <BottomBar>
        <Button title={t("Save customer")} icon="content-save" onPress={save} loading={busy} disabled={!name.trim() || !phone10} testID="customer-save" />
      </BottomBar>
    </Screen>
  );
}
