// The order: change how many, remove, discount, then take payment.
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTranslation } from "react-i18next";

import { isLoose, useCart } from "@/src/cart-context";
import { BottomBar, Button, EmptyState, Field, Header, Icon, Screen, Stepper, T, Thumb } from "@/src/components/ui";
import { formatCurrency, formatQty } from "@/src/format";
import { colors, radius, spacing } from "@/src/theme";

export default function OrderCart() {
  const { t } = useTranslation();
  const router = useRouter();
  const cart = useCart();
  const back = () => (router.canGoBack() ? router.back() : router.replace("/order/scan"));

  if (!cart.items.length) {
    return (
      <Screen bg={colors.surface}>
        <Header title={t("Order")} onBack={back} />
        <EmptyState icon="cart-outline" title={t("Nothing in this order yet")}
          action={<Button title={t("Scan a plant")} icon="camera" onPress={() => router.replace("/order/scan")} />} />
      </Screen>
    );
  }

  return (
    <Screen bg={colors.surface}>
      <Header title={t("Order · {{n}} items", { n: formatQty(cart.count) })} onBack={back} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: 10 }} bottomOffset={24}>
        {cart.items.map((it) => (
          <View key={it.product_id} testID={`cart-line-${it.name}`}
            style={{ gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Thumb path={it.image_path} size={56} icon={isLoose(it.product_id) ? "tag-outline" : "sprout"} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="bold">{it.name}</T>
                <T v="small">{t("{{price}} each", { price: formatCurrency(it.price) })}{isLoose(it.product_id) ? ` · ${t("not from stock")}` : ""}</T>
              </View>
              <T v="number">{formatCurrency(it.price * it.quantity)}</T>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable accessibilityLabel={t("Remove")} onPress={() => cart.removeItem(it.product_id)} testID={`cart-remove-${it.name}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 48, paddingRight: 12 }}>
                <Icon name="trash-can-outline" size={24} color={colors.red} />
                <T v="bold" color={colors.red}>{t("Remove")}</T>
              </Pressable>
              <Stepper value={it.quantity} min={0} max={!isLoose(it.product_id) && it.stock != null ? it.stock : 9999}
                onChange={(q) => cart.setQuantity(it.product_id, q)} testID={`cart-qty-${it.name}`} />
            </View>
          </View>
        ))}

        <Button title={t("Add more plants")} icon="plus" variant="dashed" size="md" onPress={back} testID="cart-add-more" />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
          <T v="bodyLarge" style={{ flex: 1 }}>{t("Discount ₹")}</T>
          <Field style={{ width: 140 }} value={cart.discount ? String(cart.discount) : ""} placeholder="0" keyboardType="decimal-pad"
            accessibilityLabel={t("Discount")} testID="cart-discount" inputStyle={{ textAlign: "right" }}
            onChangeText={(v) => cart.setDiscount(Number(v.replace(/[^0-9.]/g, "")) || 0)} />
        </View>
      </KeyboardAwareScrollView>

      <BottomBar>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View>
            <T v="label">{t("Total")}</T>
            {cart.gstIncluded > 0.004 && <T v="small">{t("Includes GST {{gst}}", { gst: formatCurrency(cart.gstIncluded) })}</T>}
          </View>
          <T v="amount" testID="cart-total">{formatCurrency(cart.total)}</T>
        </View>
        <Button title={t("Take payment")} icon="cash-register" onPress={() => router.push("/order/pay")} testID="cart-pay" />
      </BottomBar>
    </Screen>
  );
}
