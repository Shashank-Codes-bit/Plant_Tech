import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, fileUrl } from "@/src/api";
import { formatCurrency, formatDate } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, Icon, LoadingView, StockBadge } from "@/src/components/ui";
import { Header } from "@/src/components/header";
import { useToast } from "@/src/components/toast";

const REASONS = ["Damaged", "Dead plant", "Lost item", "Correction", "Stock count"];

export default function ProductDetail() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const product = useQuery({ queryKey: ["product", id], queryFn: () => apiGet(`/products/${id}`) });
  const history = useQuery({ queryKey: ["product-history", id], queryFn: () => apiGet(`/products/${id}/history`) });

  const [modal, setModal] = useState(false);
  const [dir, setDir] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState(REASONS[3]);

  const adjust = useMutation({
    mutationFn: () => apiPost(`/products/${id}/adjust-stock`, { change: dir * (Number(amount) || 0), reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product", id] });
      qc.invalidateQueries({ queryKey: ["product-history", id] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setModal(false);
      setAmount("");
      toast.show("Stock updated", "success");
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const p = product.data;
  if (product.isLoading || !p) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title="Product" />
        <LoadingView />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Product" right={
        <Pressable testID="product-edit" onPress={() => router.push({ pathname: "/product/new", params: { id: p.id } })} hitSlop={8}>
          <Icon name="pencil" size={24} color={colors.brandPrimary} />
        </Pressable>
      } />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <View style={s.photo}>
          {p.photo_path ? (
            <Image source={{ uri: fileUrl(p.photo_path) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <Icon name="leaf" size={64} color={colors.brandPrimary} />
          )}
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <View>
            <Text style={s.name}>{p.name}</Text>
            {!!p.botanical_name && <Text style={s.botanical}>{p.botanical_name}</Text>}
          </View>

          <View style={s.badgeRow}>
            <View style={s.catChip}>
              <Text style={s.catText}>{p.category || "Uncategorised"}</Text>
            </View>
            <StockBadge stock={p.stock} min={p.min_stock} />
          </View>

          <View style={s.grid}>
            <Info label="Selling Price" value={formatCurrency(p.selling_price)} big />
            <Info label="Cost Price" value={formatCurrency(p.cost_price)} />
            <Info label="Current Stock" value={String(p.stock)} />
            <Info label="Min Stock" value={String(p.min_stock)} />
            <Info label="SKU" value={p.sku || "—"} />
            <Info label="Supplier" value={p.supplier || "—"} />
          </View>

          {/* Stock history */}
          <Text style={s.section}>Stock History</Text>
          {(history.data?.stock_history ?? []).length === 0 ? (
            <Text style={s.emptyLine}>No stock movements yet.</Text>
          ) : (
            history.data.stock_history.slice(0, 15).map((h: any) => (
              <View key={h.id} style={s.histRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.histType}>{labelForType(h.type)}{h.reason ? ` · ${h.reason}` : ""}</Text>
                  <Text style={s.histDate}>{formatDate(h.created_at)}</Text>
                </View>
                <Text style={[s.histChange, { color: h.change >= 0 ? colors.success : colors.error }]}>
                  {h.change >= 0 ? "+" : ""}{h.change}
                </Text>
              </View>
            ))
          )}

          {/* Sales history */}
          <Text style={s.section}>Sales History</Text>
          {(history.data?.sales_history ?? []).length === 0 ? (
            <Text style={s.emptyLine}>Not sold yet.</Text>
          ) : (
            history.data.sales_history.slice(0, 15).map((h: any, i: number) => (
              <View key={i} style={s.histRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.histType}>{h.invoice_number}</Text>
                  <Text style={s.histDate}>{formatDate(h.created_at)}</Text>
                </View>
                <Text style={s.histChange}>{h.quantity} × {formatCurrency(h.price)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button title="Adjust Stock" icon="tune-variant" onPress={() => setModal(true)} testID="product-adjust-stock" />
      </View>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={s.modalWrap}>
          <View style={[s.modalCard, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Adjust Stock</Text>
            <Text style={s.modalSub}>Current: {p.stock}</Text>

            <View style={s.dirRow}>
              <Pressable testID="adjust-dir-add" style={[s.dirBtn, dir === 1 && s.dirActive]} onPress={() => setDir(1)}>
                <Icon name="plus" size={22} color={dir === 1 ? colors.onBrandPrimary : colors.onSurface} />
                <Text style={[s.dirText, dir === 1 && { color: colors.onBrandPrimary }]}>Add</Text>
              </Pressable>
              <Pressable testID="adjust-dir-remove" style={[s.dirBtn, dir === -1 && s.dirRemoveActive]} onPress={() => setDir(-1)}>
                <Icon name="minus" size={22} color={dir === -1 ? colors.onError : colors.onSurface} />
                <Text style={[s.dirText, dir === -1 && { color: colors.onError }]}>Remove</Text>
              </Pressable>
            </View>

            <TextInput
              testID="adjust-amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="Quantity"
              placeholderTextColor={colors.muted}
              style={s.amountInput}
            />

            <Text style={s.reasonLabel}>Reason</Text>
            <View style={s.reasonRow}>
              {REASONS.map((r) => (
                <Pressable key={r} testID={`adjust-reason-${r}`} style={[s.reasonChip, reason === r && s.reasonActive]} onPress={() => setReason(r)}>
                  <Text style={[s.reasonText, reason === r && { color: colors.onBrandPrimary }]}>{r}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
              <Button title="Cancel" variant="secondary" size="md" onPress={() => setModal(false)} style={{ flex: 1 }} testID="adjust-cancel" />
              <Button title="Save" size="md" onPress={() => adjust.mutate()} loading={adjust.isPending} disabled={!amount} style={{ flex: 1 }} testID="adjust-save" />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function labelForType(t: string) {
  return { sale: "Sale", purchase: "Purchase", adjustment: "Adjustment", initial: "Initial stock" }[t] || t;
}

function Info({ label, value, big }: { label: string; value: string; big?: boolean }) {
  const s = useStyles();
  return (
    <View style={s.info}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, big && s.infoBig]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  photo: {
    width: "100%",
    height: 220,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 26, fontWeight: "800", color: colors.onSurface },
  botanical: { fontSize: 16, fontStyle: "italic", color: colors.muted, marginTop: 2 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  catChip: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  catText: { fontSize: 14, fontWeight: "700", color: colors.onSurfaceTertiary },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  info: {
    width: "47.5%",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoLabel: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  infoValue: { fontSize: 18, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  infoBig: { color: colors.brandPrimary, fontSize: 20 },

  section: { fontSize: 18, fontWeight: "800", color: colors.onSurface, marginTop: spacing.md },
  emptyLine: { fontSize: 15, color: colors.muted },
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  histType: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  histDate: { fontSize: 13, color: colors.muted, marginTop: 2 },
  histChange: { fontSize: 16, fontWeight: "800", color: colors.onSurface },

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

  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(11,18,12,0.5)" },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
  },
  modalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.md },
  modalTitle: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  modalSub: { fontSize: 15, color: colors.muted, marginBottom: spacing.md },
  dirRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  dirBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
  },
  dirActive: { backgroundColor: colors.brandPrimary },
  dirRemoveActive: { backgroundColor: colors.error },
  dirText: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  amountInput: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    minHeight: 60,
    color: colors.onSurface,
  },
  reasonLabel: { fontSize: 15, fontWeight: "700", color: colors.onSurface, marginTop: spacing.md, marginBottom: spacing.sm },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  reasonChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surfaceTertiary },
  reasonActive: { backgroundColor: colors.brandPrimary },
  reasonText: { fontSize: 14, fontWeight: "700", color: colors.onSurfaceTertiary },
}));
