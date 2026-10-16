// Payment: optional customer WhatsApp number (to send the bill), then tap how they paid.
// Cash and Card make the bill straight away; UPI first shows the shop's pay QR.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTranslation } from "react-i18next";

import { apiGet } from "@/src/api";
import { useCart } from "@/src/cart-context";
import { Field, Header, Icon, IconName, PhoneField, Screen, T } from "@/src/components/ui";
import { formatCurrency, formatQty, normalizePhone } from "@/src/format";
import { PaymentMethod, setPayer, useCreateBill } from "@/src/order";
import { colors, radius, spacing } from "@/src/theme";
import type { Business } from "@/src/types";

const METHODS: { m: PaymentMethod; icon: IconName }[] = [
  { m: "Cash", icon: "cash" },
  { m: "UPI", icon: "qrcode" },
  { m: "Card", icon: "credit-card-outline" },
];

export default function OrderPay() {
  const { t } = useTranslation();
  const router = useRouter();
  const cart = useCart();
  const bill = useCreateBill();
  const biz = useQuery<Business>({ queryKey: ["business"], queryFn: () => apiGet("/business") });
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const phone10 = normalizePhone(phone);
  const lookup = useQuery<{ found: boolean; name: string; purchase_count: number }>({
    queryKey: ["customer-lookup", phone10],
    queryFn: () => apiGet(`/customers/lookup?phone=${phone10}`),
    enabled: !!phone10,
  });
  const phoneBad = phone.length > 0 && !phone10;

  function pay(m: PaymentMethod) {
    if (phoneBad) return;
    if (m === "UPI" && biz.data?.upi_id) {
      setPayer({ phone: phone10 ?? "", name });
      router.push("/order/upi");
      return;
    }
    bill.create(m, phone10 ?? "", name);
  }

  return (
    <Screen bg={colors.surface}>
      <Header title={t("Payment")} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: 18 }} bottomOffset={24} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", padding: 18, borderRadius: radius.xl, backgroundColor: colors.greenTint }}>
          <T v="label" color={colors.greenDark}>{t("Customer pays")}</T>
          <T v="amount" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 52, lineHeight: 58 }} testID="pay-total">{formatCurrency(cart.total)}</T>
          <T v="small" color={colors.greenDark}>
            {[t("{{n}} items", { n: formatQty(cart.count) }),
              cart.gstIncluded > 0.004 ? t("includes GST {{gst}}", { gst: formatCurrency(cart.gstIncluded) }) : ""].filter(Boolean).join(" · ")}
          </T>
        </View>

        <View style={{ gap: 10 }}>
          <PhoneField label={t("Customer's WhatsApp number (to send the bill)")} value={phone} onChangeText={setPhone} testID="pay-phone"
            error={phoneBad && phone.length === 10 ? t("Enter a 10-digit mobile number") : undefined} hint={!phone ? t("Optional") : undefined} />
          {lookup.data?.found ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon name="account-check" size={24} color={colors.green} />
              <T v="bold" color={colors.greenDark}>
                {lookup.data.purchase_count
                  ? t("{{name}} · bought {{n}} times before", { name: lookup.data.name, n: lookup.data.purchase_count })
                  : lookup.data.name}
              </T>
            </View>
          ) : phone10 && lookup.data ? (
            <Field label={t("Customer name (optional)")} value={name} onChangeText={setName} autoCapitalize="words" testID="pay-name" />
          ) : null}
        </View>

        <View style={{ gap: 10 }}>
          <T v="label">{t("How is the customer paying?")}</T>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {METHODS.map(({ m, icon }) => (
              <Pressable key={m} testID={`pay-${m}`} disabled={bill.busy || phoneBad} onPress={() => pay(m)}
                style={({ pressed }) => ({ flex: 1, alignItems: "center", justifyContent: "center", gap: 6, minHeight: 112, borderRadius: radius.lg,
                  borderWidth: 2, borderColor: colors.green, backgroundColor: pressed ? colors.greenTint : colors.surface,
                  opacity: bill.busy || phoneBad ? 0.5 : 1 })}>
                <Icon name={icon} size={40} color={colors.green} />
                <T v="bodyLarge" color={colors.greenDark}>{t(m)}</T>
              </Pressable>
            ))}
          </View>
          <T v="small" style={{ textAlign: "center" }}>
            {bill.busy ? t("Making the bill…") : t("Tap how they paid. The bill is made straight away.")}
          </T>
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}
