// Payment: who is paying (the order's customer) and how. Cash and Card make the bill straight away;
// UPI first shows the shop's pay QR.
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet } from "@/src/api";
import { useCart } from "@/src/cart-context";
import { OrderCustomerBar } from "@/src/components/order-customer";
import { Header, Icon, IconName, Screen, T } from "@/src/components/ui";
import { formatCurrency, plural } from "@/src/format";
import { PaymentMethod, useCreateBill } from "@/src/order";
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
  // Opened with no customer (a reload, an old link): pick one first. Not when the order is cleared while open (Discard).
  const [openedWithout] = useState(() => !cart.customer);
  const bill = useCreateBill();
  const biz = useQuery<Business>({ queryKey: ["business"], queryFn: () => apiGet("/business") });

  if (openedWithout) return <Redirect href="/order/customer" />;

  function pay(m: PaymentMethod) {
    if (m === "UPI" && biz.data?.upi_id) {
      router.push("/order/upi");
      return;
    }
    bill.create(m);
  }

  return (
    <Screen bg={colors.surface}>
      <Header title={t("Payment")} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 18 }}>
        <View style={{ alignItems: "center", padding: 18, borderRadius: radius.xl, backgroundColor: colors.greenTint }}>
          <T v="label" color={colors.greenDark}>{t("Customer pays")}</T>
          <T v="amount" style={{ fontSize: 52, lineHeight: 58 }} testID="pay-total">{formatCurrency(cart.total)}</T>
          <T v="small" color={colors.greenDark}>
            {[plural(cart.count, "1 item", "{{n}} items"),
              cart.gstIncluded > 0.004 ? t("includes GST {{gst}}", { gst: formatCurrency(cart.gstIncluded) }) : ""].filter(Boolean).join(" · ")}
          </T>
        </View>

        <View style={{ gap: 8 }}>
          <T v="label">{t("Customer")}</T>
          <OrderCustomerBar />
        </View>

        <View style={{ gap: 10 }}>
          <T v="label">{t("How is the customer paying?")}</T>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {METHODS.map(({ m, icon }) => (
              <Pressable key={m} testID={`pay-${m}`} disabled={bill.busy || !cart.customer} onPress={() => pay(m)}
                style={({ pressed }) => ({ flex: 1, alignItems: "center", justifyContent: "center", gap: 6, minHeight: 112, borderRadius: radius.lg,
                  borderWidth: 2, borderColor: colors.green, backgroundColor: pressed ? colors.greenTint : colors.surface,
                  opacity: bill.busy ? 0.5 : 1 })}>
                <Icon name={icon} size={40} color={colors.green} />
                <T v="bodyLarge" color={colors.greenDark}>{t(m)}</T>
              </Pressable>
            ))}
          </View>
          <T v="small" style={{ textAlign: "center" }}>
            {bill.busy ? t("Making the bill…") : t("Tap how they paid. The bill is made straight away.")}
          </T>
        </View>
      </ScrollView>
    </Screen>
  );
}
