import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";

import { apiGet, fileUrl } from "@/src/api";
import { formatCurrency } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, EmptyState, Icon, Stepper } from "@/src/components/ui";
import { useCart } from "@/src/cart-context";

export default function Billing() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items, setQuantity, removeItem, subtotal, clear } = useCart();
  const [discountText, setDiscountText] = useState("");

  const business = useQuery({ queryKey: ["business"], queryFn: () => apiGet("/business") });
  const taxPercent = business.data?.tax_enabled ? Number(business.data?.tax_percent || 0) : 0;

  const discount = Math.min(Number(discountText) || 0, subtotal);
  const taxAmount = taxPercent ? ((subtotal - discount) * taxPercent) / 100 : 0;
  const grandTotal = subtotal - discount + taxAmount;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={s.title}>Cart</Text>
        {items.length > 0 && (
          <Pressable testID="cart-clear" onPress={clear} hitSlop={8}>
            <Text style={s.clear}>Clear</Text>
          </Pressable>
        )}
      </View>

      {items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            icon="cart-outline"
            title="Cart is empty"
            subtitle="Scan a plant or search products to start a bill."
          />
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md }}>
            <Button title="Scan Plant" icon="camera" onPress={() => router.push("/scan")} testID="cart-empty-scan" />
            <Button
              title="Search Products"
              icon="magnify"
              variant="secondary"
              onPress={() => router.push("/search")}
              testID="cart-empty-search"
            />
          </View>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            <View style={s.addRow}>
              <Pressable testID="cart-add-scan" style={s.addBtn} onPress={() => router.push("/scan")}>
                <Icon name="camera" size={20} color={colors.brandPrimary} />
                <Text style={s.addBtnText}>Scan</Text>
              </Pressable>
              <Pressable testID="cart-add-search" style={s.addBtn} onPress={() => router.push("/search")}>
                <Icon name="magnify" size={20} color={colors.brandPrimary} />
                <Text style={s.addBtnText}>Add Product</Text>
              </Pressable>
            </View>

            {items.map((it) => (
              <View key={it.product_id} style={s.item} testID={`cart-item-${it.product_id}`}>
                <View style={s.thumb}>
                  {it.photo_path ? (
                    <Image source={{ uri: fileUrl(it.photo_path) }} style={s.thumbImg} contentFit="cover" />
                  ) : (
                    <Icon name="leaf" size={26} color={colors.brandPrimary} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={s.itemName} numberOfLines={1}>
                    {it.name}
                  </Text>
                  <Text style={s.itemPrice}>
                    {formatCurrency(it.price)} × {it.quantity} ={" "}
                    <Text style={{ fontWeight: "800", color: colors.onSurface }}>
                      {formatCurrency(it.price * it.quantity)}
                    </Text>
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <Stepper
                      value={it.quantity}
                      onChange={(v) => setQuantity(it.product_id, v)}
                      testID={`cart-stepper-${it.product_id}`}
                    />
                    <Pressable
                      testID={`cart-remove-${it.product_id}`}
                      onPress={() => removeItem(it.product_id)}
                      hitSlop={8}
                      style={s.removeBtn}
                    >
                      <Icon name="trash-can-outline" size={22} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}

            <View style={s.discountBox}>
              <Text style={s.discountLabel}>Discount (₹)</Text>
              <TextInput
                testID="cart-discount-input"
                value={discountText}
                onChangeText={setDiscountText}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={s.discountInput}
              />
            </View>
          </ScrollView>

          {/* Sticky footer */}
          <View style={[s.footer, { paddingBottom: spacing.md }]}>
            <Row label="Subtotal" value={formatCurrency(subtotal)} />
            {discount > 0 && <Row label="Discount" value={`- ${formatCurrency(discount)}`} />}
            {taxPercent > 0 && <Row label={`Tax (${taxPercent}%)`} value={formatCurrency(taxAmount)} />}
            <View style={s.grandRow}>
              <Text style={s.grandLabel}>Grand Total</Text>
              <Text style={s.grandValue} testID="cart-grand-total">
                {formatCurrency(grandTotal)}
              </Text>
            </View>
            <Button
              title="Collect Payment"
              icon="cash-multiple"
              onPress={() => router.push({ pathname: "/payment", params: { discount: String(discount), taxPercent: String(taxPercent) } })}
              testID="cart-collect-payment"
            />
          </View>
        </>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <View style={s.sumRow}>
      <Text style={s.sumLabel}>{label}</Text>
      <Text style={s.sumValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: 28, fontWeight: "800", color: colors.onSurface },
  clear: { fontSize: 16, fontWeight: "700", color: colors.error },

  addRow: { flexDirection: "row", gap: spacing.md },
  addBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
  },
  addBtnText: { fontSize: 16, fontWeight: "700", color: colors.brandPrimary },

  item: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImg: { width: "100%", height: "100%" },
  itemName: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  itemPrice: { fontSize: 15, color: colors.muted },
  removeBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },

  discountBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  discountLabel: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  discountInput: {
    minWidth: 100,
    textAlign: "right",
    fontSize: 18,
    fontWeight: "700",
    color: colors.onSurface,
    paddingVertical: 8,
  },

  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: 6,
  },
  sumRow: { flexDirection: "row", justifyContent: "space-between" },
  sumLabel: { fontSize: 16, color: colors.muted },
  sumValue: { fontSize: 16, fontWeight: "600", color: colors.onSurface },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 6,
  },
  grandLabel: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  grandValue: { fontSize: 26, fontWeight: "800", color: colors.brandPrimary },
}));
