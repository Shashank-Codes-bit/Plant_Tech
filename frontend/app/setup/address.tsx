import { useState } from "react";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet, apiPut } from "@/src/api";
import { useAuth } from "@/src/auth";
import { SetupFrame } from "@/src/components/setup-frame";
import { useToast } from "@/src/components/toast";
import { Field, LoadingView, PhoneField, Screen } from "@/src/components/ui";
import { normalizePhone } from "@/src/format";
import { colors } from "@/src/theme";
import type { Business } from "@/src/types";

export default function SetupAddress() {
  const biz = useQuery<Business>({ queryKey: ["business"], queryFn: () => apiGet("/business") });
  if (!biz.data) return <Screen bg={colors.surface}><LoadingView /></Screen>;
  return <AddressStep biz={biz.data} />;
}

function AddressStep({ biz }: { biz: Business }) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [address, setAddress] = useState(biz.address || "");
  const [phone, setPhone] = useState(normalizePhone(biz.phone || user?.phone || "") || "");
  const [busy, setBusy] = useState(false);

  async function next() {
    setBusy(true);
    try {
      await apiPut("/business", { address: address.trim(), phone: phone ? `+91${phone}` : "" });
      router.push("/setup/billing");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupFrame step={2} title={t("Where is your shop?")} onNext={next} busy={busy}
      nextDisabled={!!phone && !normalizePhone(phone)}>
      <Field label={t("Shop address")} value={address} onChangeText={setAddress} multiline testID="setup-address" />
      <PhoneField label={t("Shop phone (customers will see this)")} value={phone} onChangeText={setPhone}
        error={phone && !normalizePhone(phone) ? t("Enter a 10-digit mobile number") : undefined} />
    </SetupFrame>
  );
}
