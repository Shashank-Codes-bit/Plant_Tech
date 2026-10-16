// New order, step 1: who is buying? Every order has a customer (name + phone), so bills can be sent on
// WhatsApp and each customer's history is complete. Search, or add a new one.
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet, apiPost } from "@/src/api";
import { OrderCustomer, useCart } from "@/src/cart-context";
import { useToast } from "@/src/components/toast";
import { Button, Field, Header, Icon, PhoneField, Screen, T } from "@/src/components/ui";
import { formatPhone, normalizePhone } from "@/src/format";
import { colors, fonts, radius, spacing } from "@/src/theme";

export default function OrderCustomerStep() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const cart = useCart();
  const { change } = useLocalSearchParams<{ change?: string }>();
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setQ(typed.trim()), 300);
    return () => clearTimeout(id);
  }, [typed]);

  const found = useQuery<OrderCustomer[]>({ queryKey: ["customer-find", q], queryFn: () => apiGet(`/customers/find?q=${encodeURIComponent(q)}`) });
  const results = found.data ?? [];
  const noMatch = !!q && found.isSuccess && !results.length;

  function choose(c: OrderCustomer) {
    cart.setCustomer(c);
    if (change) router.back();
    else router.replace("/order/scan");
  }

  function startAdding() {
    const digits = normalizePhone(typed);
    setPhone(digits ?? (/^\d+$/.test(typed.trim()) ? typed.trim().slice(-10) : ""));
    setName(digits || /^\d+$/.test(typed.trim()) ? "" : typed.trim());
    setAdding(true);
  }

  const phone10 = normalizePhone(phone);
  async function save() {
    setBusy(true);
    try {
      const c = await apiPost("/customers", { name: name.trim(), phone: `+91${phone10}` });
      choose({ id: c.id, name: c.name, phone: c.phone, purchase_count: 0 });
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen bg={colors.surface}>
      <Header title={change ? t("Change customer") : t("New order")} close={!change} onBack={() => router.back()} testID="customer-close" />
      <View style={{ paddingHorizontal: spacing.lg, gap: 12, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" }}>
            <T v="bold" color={colors.white}>1</T>
          </View>
          <T v="title">{t("Who is buying?")}</T>
        </View>
        {!adding && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 60, paddingHorizontal: 14, borderWidth: 2,
            borderColor: typed ? colors.green : colors.lineStrong, borderRadius: 16 }}>
            <Icon name="magnify" size={26} color={colors.muted} />
            <TextInput value={typed} onChangeText={setTyped} placeholder={t("Name or phone number")} placeholderTextColor={colors.muted}
              autoFocus testID="customer-search" style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 19, color: colors.ink, minHeight: 56 }} />
            {found.isFetching && <ActivityIndicator color={colors.green} />}
          </View>
        )}
      </View>

      {adding ? (
        <View style={{ padding: spacing.lg, paddingTop: 4, gap: 14 }}>
          <T v="bodyLarge">{t("New customer")}</T>
          <Field label={t("Name")} value={name} onChangeText={setName} autoCapitalize="words" autoFocus={!name} testID="customer-new-name" />
          <PhoneField label={t("Phone number (WhatsApp)")} value={phone} onChangeText={setPhone} testID="customer-new-phone"
            error={phone.length === 10 && !phone10 ? t("Enter a 10-digit mobile number") : undefined} />
          <Button title={t("Save and continue")} icon="arrow-right" onPress={save} loading={busy} disabled={!name.trim() || !phone10} testID="customer-new-save" />
          <Button title={t("Back to search")} variant="outline" size="md" onPress={() => setAdding(false)} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: 8 }}
          ListHeaderComponent={
            <View style={{ gap: 8, marginBottom: 4 }}>
              <Pressable onPress={startAdding} testID="customer-add"
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, minHeight: 64, borderRadius: radius.lg,
                  borderWidth: 2, borderStyle: "dashed", borderColor: colors.green, backgroundColor: pressed ? colors.greenTint : colors.surface })}>
                <Icon name="account-plus" size={28} color={colors.green} />
                <View style={{ flex: 1 }}>
                  <T v="bold" color={colors.greenDark}>{typed.trim() ? t("Add “{{q}}” as a new customer", { q: typed.trim() }) : t("New customer")}</T>
                  <T v="small">{t("Name and phone number")}</T>
                </View>
              </Pressable>
              {noMatch && <T v="small">{t("No customer found with that name or number.")}</T>}
              {!q && results.length > 0 && <T v="label">{t("Recent customers")}</T>}
            </View>
          }
          renderItem={({ item: c }) => (
            <Pressable onPress={() => choose(c)} testID={`customer-pick-${c.name}`}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, minHeight: 68, borderRadius: radius.lg,
                borderWidth: 1, borderColor: cart.customer?.id === c.id ? colors.green : colors.line, backgroundColor: pressed ? colors.page : colors.surface })}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center" }}>
                <T v="number" color={colors.greenDark}>{c.name.charAt(0).toUpperCase()}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T v="bold">{c.name}</T>
                <T v="small">{formatPhone(c.phone)}</T>
              </View>
              {!!c.purchase_count && <T v="caption">{c.purchase_count === 1 ? t("1 order") : t("{{n}} orders", { n: c.purchase_count })}</T>}
              <Icon name="chevron-right" size={24} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
