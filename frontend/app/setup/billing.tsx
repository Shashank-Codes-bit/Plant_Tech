import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet, apiPut } from "@/src/api";
import { SetupFrame } from "@/src/components/setup-frame";
import { useToast } from "@/src/components/toast";
import { Field, LoadingView, Screen, T, Toggle } from "@/src/components/ui";
import { colors, radius } from "@/src/theme";
import type { Business } from "@/src/types";

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

export default function SetupBilling() {
  const biz = useQuery<Business>({ queryKey: ["business"], queryFn: () => apiGet("/business") });
  if (!biz.data) return <Screen bg={colors.surface}><LoadingView /></Screen>;
  return <BillingStep biz={biz.data} />;
}

function BillingStep({ biz }: { biz: Business }) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [upi, setUpi] = useState(biz.upi_id || "");
  const [gst, setGst] = useState(!!biz.gst_registered);
  const [gstin, setGstin] = useState(biz.gstin || "");
  const [busy, setBusy] = useState(false);

  const gstinBad = gst && gstin.length > 0 && !GSTIN.test(gstin.toUpperCase());

  async function next() {
    setBusy(true);
    try {
      await apiPut("/business", { upi_id: upi.trim(), gst_registered: gst, gstin: gst ? gstin.toUpperCase() : "" });
      await qc.invalidateQueries({ queryKey: ["business"] });
      router.push("/setup/categories");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupFrame step={3} title={t("Bills and payments")} subtitle={t("Both are optional and can be changed later in Shop details.")}
      onNext={next} busy={busy} nextDisabled={gstinBad || (gst && !gstin)}>
      <Field label={t("UPI ID (shows a payment QR code to customers)")} value={upi} onChangeText={setUpi} autoCapitalize="none"
        placeholder="shopname@okaxis" testID="setup-upi" />
      <View style={{ gap: 12, padding: 16, borderRadius: radius.lg, backgroundColor: colors.page }}>
        <Toggle title={t("GST registered")} subtitle={t("Turn on to show GST on your bills. Leave off if your shop is not registered.")} value={gst} onChange={setGst} testID="setup-gst" />
        {gst && (
          <>
            <Field label={t("GST number")} value={gstin} onChangeText={(v) => setGstin(v.toUpperCase())} autoCapitalize="characters"
              maxLength={15} placeholder="06ABCDE1234F1Z5" error={gstinBad ? t("This does not look like a valid GST number") : undefined} />
            <T v="small" style={{ color: colors.inkSoft }}>
              {t("The GST % is set per category in the next step. Prices you type include GST.")}
            </T>
          </>
        )}
      </View>
    </SetupFrame>
  );
}
