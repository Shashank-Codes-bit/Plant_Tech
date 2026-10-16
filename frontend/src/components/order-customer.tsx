// "For: Anita Sharma · +91 98111 22334   Change" — the order's customer, shown on every order step.
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useCart } from "@/src/cart-context";
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
