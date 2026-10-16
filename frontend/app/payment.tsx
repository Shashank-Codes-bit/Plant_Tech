import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPost } from "@/src/api";
import { formatCurrency } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Field, Icon } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { useCart } from "@/src/cart-context";

const METHODS = [
  { key: "Cash", icon: "cash", color: "success" as const },
  { key: "UPI", icon: "qrcode", color: "brand" as const },
  { key: "Card", icon: "credit-card", color: "brand" as const },
];

export default function Payment() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { items, subtotal, clear } = useCart();
  const params = useLocalSearchParams<{ discount?: string; taxPercent?: string }>();

  const discount = Number(params.discount) || 0;
  const taxPercent = Number(params.taxPercent) || 0;
  const taxAmount = taxPercent ? ((subtotal - discount) * taxPercent) / 100 : 0;
  const grandTotal = subtotal - discount + taxAmount;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saveCustomer, setSaveCustomer] = useState(false);

  const pay = useMutation({
    mutationFn: async (method: string) => {
      let customerId: string | null = null;
      const custName = name.trim() || "Walk-in Customer";
      if (saveCustomer && name.trim()) {
        const c = await apiPost("/customers", { name: name.trim(), phone: phone.trim() });
        customerId = c.id;
      }
      return apiPost("/invoices", {
        items: items.map((i) => ({
          // "loose-…" lines (billed without stock) have no product to deduct stock from
          product_id: i.product_id.startsWith("loose-") ? null : i.product_id,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
        customer_id: customerId,
        customer_name: custName,
        customer_phone: phone.trim(),
        discount,
        tax_percent: taxPercent,
        payment_method: method,
      });
    },
    onSuccess: (invoice) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      clear();
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      router.replace({ pathname: `/invoice/${invoice.id}`, params: { justPaid: "1" } });
    },
    onError: (e: any) => toast.show(e.message || "Payment failed", "error"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="payment-close" onPress={() => router.back()} hitSlop={10} style={s.closeBtn}>
          <Icon name="chevron-down" size={30} color={colors.onSurface} />
        </Pressable>
        <Text style={s.headerTitle}>Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        bottomOffset={20}
      >
        <View style={s.totalCard}>
          <Text style={s.totalLabel}>Amount to Collect</Text>
          <Text style={s.totalValue} testID="payment-total">
            {formatCurrency(grandTotal)}
          </Text>
          <Text style={s.totalSub}>{items.length} items</Text>
        </View>

        <Text style={s.section}>Customer (optional)</Text>
        <View style={{ gap: spacing.md }}>
          <Field label="Name" placeholder="Walk-in Customer" value={name} onChangeText={setName} testID="payment-customer-name" />
          <Field label="Phone" placeholder="Optional" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="payment-customer-phone" />
          {!!name.trim() && (
            <View style={s.saveRow}>
              <Text style={s.saveLabel}>Save as customer</Text>
              <Switch
                testID="payment-save-customer"
                value={saveCustomer}
                onValueChange={setSaveCustomer}
                trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }}
                thumbColor="#FFFFFF"
              />
            </View>
          )}
        </View>

        <Text style={s.section}>Payment Method</Text>
        <View style={{ gap: spacing.md }}>
          {METHODS.map((m) => (
            <Pressable
              key={m.key}
              testID={`payment-method-${m.key.toLowerCase()}`}
              disabled={pay.isPending}
              style={({ pressed }) => [s.method, pressed && { opacity: 0.85 }]}
              onPress={() => pay.mutate(m.key)}
            >
              <View style={[s.methodIcon, m.key === "Cash" && { backgroundColor: colors.success }]}>
                <Icon name={m.icon as any} size={28} color={colors.onBrandPrimary} />
              </View>
              <Text style={s.methodText}>{m.key}</Text>
              <Icon name="chevron-right" size={26} color={colors.muted} />
            </Pressable>
          ))}
        </View>
        <Text style={s.note}>Tap a method to complete the sale.</Text>
      </KeyboardAwareScrollView>

      {pay.isPending && (
        <View style={s.processing} testID="payment-processing">
          <Icon name="loading" size={40} color="#FFFFFF" />
          <Text style={s.processingText}>Completing sale…</Text>
        </View>
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontWeight: "800", color: colors.onSurface },

  totalCard: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
  },
  totalLabel: { fontSize: 16, color: colors.onBrandPrimary, opacity: 0.85, fontWeight: "600" },
  totalValue: { fontSize: 44, fontWeight: "800", color: colors.onBrandPrimary, marginVertical: 4 },
  totalSub: { fontSize: 15, color: colors.onBrandPrimary, opacity: 0.85 },

  section: { fontSize: 18, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  saveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  saveLabel: { fontSize: 16, fontWeight: "700", color: colors.onSurface },

  method: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  methodIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  methodText: { flex: 1, fontSize: 22, fontWeight: "800", color: colors.onSurface },
  note: { fontSize: 14, color: colors.muted, textAlign: "center", marginTop: spacing.lg },

  processing: {
    ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const),
    backgroundColor: "rgba(11,18,12,0.7)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  processingText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
}));
