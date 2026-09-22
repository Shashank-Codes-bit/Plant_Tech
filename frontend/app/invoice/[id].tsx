import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/src/api";
import { formatCurrency, formatDate } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, Icon, LoadingView } from "@/src/components/ui";
import { Header } from "@/src/components/header";
import { useToast } from "@/src/components/toast";

export default function InvoiceDetail() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { id, justPaid } = useLocalSearchParams<{ id: string; justPaid?: string }>();

  const invoice = useQuery({ queryKey: ["invoice", id], queryFn: () => apiGet(`/invoices/${id}`) });
  const business = useQuery({ queryKey: ["business"], queryFn: () => apiGet("/business") });

  const inv = invoice.data;
  const biz = business.data;

  async function share() {
    if (!inv) return;
    const html = buildHtml(inv, biz);
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share Invoice" });
      } else {
        toast.show("Sharing not available on this device", "error");
      }
    } catch (e: any) {
      toast.show("Could not create PDF", "error");
    }
  }

  if (invoice.isLoading || !inv) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title="Invoice" onBack={() => router.replace("/(tabs)")} />
        <LoadingView />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={inv.invoice_number} onBack={() => router.replace(justPaid ? "/(tabs)" : "/history")} />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 160 }}>
        {justPaid === "1" && (
          <View style={s.paidBanner} testID="invoice-paid-banner">
            <Icon name="check-circle" size={28} color={colors.onSuccess} />
            <View>
              <Text style={s.paidTitle}>Payment Complete</Text>
              <Text style={s.paidSub}>Inventory updated automatically</Text>
            </View>
          </View>
        )}

        <View style={s.receipt}>
          <Text style={s.bizName}>{biz?.business_name ?? "Nursery"}</Text>
          {!!biz?.phone && <Text style={s.bizMeta}>{biz.phone}</Text>}
          {!!biz?.address && <Text style={s.bizMeta}>{biz.address}</Text>}

          <View style={s.divider} />

          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Invoice</Text>
            <Text style={s.metaValue}>{inv.invoice_number}</Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Date</Text>
            <Text style={s.metaValue}>{formatDate(inv.created_at)}</Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Customer</Text>
            <Text style={s.metaValue}>{inv.customer_name}</Text>
          </View>
          {!!inv.customer_phone && (
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Phone</Text>
              <Text style={s.metaValue}>{inv.customer_phone}</Text>
            </View>
          )}

          <View style={s.divider} />

          {inv.items.map((it: any, idx: number) => (
            <View key={idx} style={s.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{it.name}</Text>
                <Text style={s.itemQty}>
                  {formatCurrency(it.price)} × {it.quantity}
                </Text>
              </View>
              <Text style={s.itemTotal}>{formatCurrency(it.price * it.quantity)}</Text>
            </View>
          ))}

          <View style={s.divider} />

          <SumRow label="Subtotal" value={formatCurrency(inv.subtotal)} />
          {inv.discount > 0 && <SumRow label="Discount" value={`- ${formatCurrency(inv.discount)}`} />}
          {inv.tax_amount > 0 && <SumRow label={`Tax (${inv.tax_percent}%)`} value={formatCurrency(inv.tax_amount)} />}

          <View style={s.grandRow}>
            <Text style={s.grandLabel}>Total</Text>
            <Text style={s.grandValue}>{formatCurrency(inv.grand_total)}</Text>
          </View>

          <View style={s.payRow}>
            <View style={s.payBadge}>
              <Icon name="check" size={16} color={colors.onSuccess} />
              <Text style={s.payBadgeText}>PAID · {inv.payment_method}</Text>
            </View>
          </View>

          <Text style={s.thanks}>Thank you! Visit again 🌱</Text>
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button title="Share Invoice" icon="share-variant" onPress={share} testID="invoice-share" />
        {justPaid === "1" ? (
          <Button title="New Sale" icon="plus" variant="secondary" onPress={() => router.replace("/(tabs)")} testID="invoice-new-sale" style={{ marginTop: spacing.sm }} />
        ) : null}
      </View>
    </View>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <View style={s.sumRow}>
      <Text style={s.sumLabel}>{label}</Text>
      <Text style={s.sumValue}>{value}</Text>
    </View>
  );
}

function buildHtml(inv: any, biz: any) {
  const rows = inv.items
    .map(
      (it: any) =>
        `<tr><td>${it.name}</td><td style="text-align:center">${it.quantity}</td><td style="text-align:right">₹${it.price}</td><td style="text-align:right">₹${(it.price * it.quantity).toFixed(2)}</td></tr>`,
    )
    .join("");
  return `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>body{font-family:-apple-system,Roboto,sans-serif;padding:24px;color:#0B120C}
  h1{color:#1B4D3E;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{padding:8px 4px;border-bottom:1px solid #ddd;font-size:14px}
  .total{font-size:22px;font-weight:800;color:#1B4D3E;text-align:right;margin-top:16px}
  .meta{color:#5C7563;font-size:13px}.paid{display:inline-block;background:#287D3C;color:#fff;padding:6px 12px;border-radius:8px;font-weight:700;margin-top:12px}
  </style></head><body>
  <h1>${biz?.business_name ?? "Nursery"}</h1>
  <div class="meta">${biz?.phone ?? ""} ${biz?.address ? "· " + biz.address : ""}</div>
  <div class="meta" style="margin-top:12px">Invoice: <b>${inv.invoice_number}</b><br/>Date: ${new Date(inv.created_at).toLocaleString("en-IN")}<br/>Customer: ${inv.customer_name} ${inv.customer_phone ? "· " + inv.customer_phone : ""}</div>
  <table><thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="meta" style="text-align:right;margin-top:12px">Subtotal: ₹${inv.subtotal}${inv.discount > 0 ? "<br/>Discount: - ₹" + inv.discount : ""}${inv.tax_amount > 0 ? "<br/>Tax: ₹" + inv.tax_amount : ""}</div>
  <div class="total">Total: ₹${inv.grand_total}</div>
  <div style="text-align:right"><span class="paid">PAID · ${inv.payment_method}</span></div>
  <p style="text-align:center;color:#5C7563;margin-top:24px">Thank you! Visit again 🌱</p>
  </body></html>`;
}

const useStyles = makeStyles((colors) => ({
  paidBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.success,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  paidTitle: { fontSize: 20, fontWeight: "800", color: colors.onSuccess },
  paidSub: { fontSize: 14, color: colors.onSuccess, opacity: 0.9 },

  receipt: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bizName: { fontSize: 26, fontWeight: "800", color: colors.brandPrimary, textAlign: "center" },
  bizMeta: { fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  metaLabel: { fontSize: 15, color: colors.muted },
  metaValue: { fontSize: 15, fontWeight: "700", color: colors.onSurface },

  itemRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  itemName: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  itemQty: { fontSize: 14, color: colors.muted, marginTop: 2 },
  itemTotal: { fontSize: 17, fontWeight: "800", color: colors.onSurface },

  sumRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  sumLabel: { fontSize: 15, color: colors.muted },
  sumValue: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  grandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  grandLabel: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  grandValue: { fontSize: 26, fontWeight: "800", color: colors.brandPrimary },

  payRow: { alignItems: "center", marginTop: spacing.lg },
  payBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.success,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  payBadgeText: { color: colors.onSuccess, fontWeight: "800", fontSize: 14 },
  thanks: { textAlign: "center", color: colors.muted, marginTop: spacing.lg, fontSize: 15 },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
}));
