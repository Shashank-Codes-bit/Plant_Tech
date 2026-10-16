// "Anita Sharma · +91 98111 22334   Change" — the order's customer, shown on every order step.
// DiscardOrder: the small "Discard" in the order headers; a discarded order is not kept.
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useCart } from "@/src/cart-context";
import { confirm } from "@/src/confirm";
import { Icon, T } from "@/src/components/ui";
import { formatPhone } from "@/src/format";
import { colors, radius } from "@/src/theme";

export function OrderCustomerBar() {
  const { t } = useTranslation();
  const router = useRouter();
  const { customer } = useCart();
  if (!customer) return null;
  return (
    <Pressable testID="order-customer" accessibilityRole="button" accessibilityLabel={t("Change customer")}
      onPress={() => router.push({ pathname: "/order/customer", params: { change: "1" } })}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 8, minHeight: 56,
        borderRadius: radius.md, backgroundColor: pressed ? colors.greenTint : colors.page, borderWidth: 1, borderColor: colors.line })}>
      <Icon name="account" size={24} color={colors.green} />
      <View style={{ flex: 1 }}>
        <T v="bold">{customer.name}</T>
        <T v="small">{formatPhone(customer.phone)}</T>
      </View>
      <T v="bold" color={colors.green}>{t("Change")}</T>
    </Pressable>
  );
}

export function DiscardOrder() {
  const { t } = useTranslation();
  const router = useRouter();
  const cart = useCart();
  if (!cart.customer) return null;
  async function discard() {
    const yes = await confirm(t("Discard this order?"), t("The items are removed and the order is not kept. The customer stays saved."), t("Discard"), true);
    if (!yes) return;
    await cart.discard();
    router.dismissTo("/(tabs)");
  }
  return (
    <Pressable testID="order-discard" accessibilityRole="button" accessibilityLabel={t("Discard order")} onPress={discard}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingHorizontal: 10, marginRight: 6,
        borderRadius: radius.md, backgroundColor: pressed ? colors.redTint : "transparent" })}>
      <Icon name="trash-can-outline" size={20} color={colors.red} />
      <T v="bold" color={colors.red} style={{ fontSize: 15 }}>{t("Discard")}</T>
    </Pressable>
  );
}
