import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/src/api";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, Field, LoadingView } from "@/src/components/ui";
import { Header } from "@/src/components/header";
import { useToast } from "@/src/components/toast";

export default function BusinessSettings() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const business = useQuery({ queryKey: ["business"], queryFn: () => apiGet("/business") });

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxPercent, setTaxPercent] = useState("");

  useEffect(() => {
    if (business.data) {
      const b = business.data;
      setBusinessName(b.business_name || "");
      setOwnerName(b.owner_name || "");
      setPhone(b.phone || "");
      setAddress(b.address || "");
      setTaxEnabled(!!b.tax_enabled);
      setTaxPercent(b.tax_percent ? String(b.tax_percent) : "");
    }
  }, [business.data]);

  const save = useMutation({
    mutationFn: () =>
      apiPost("/business", {
        business_name: businessName.trim(),
        owner_name: ownerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        currency: "₹",
        tax_enabled: taxEnabled,
        tax_percent: taxEnabled ? Number(taxPercent) || 0 : 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business"] });
      toast.show("Saved", "success");
      router.back();
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  if (business.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title="Business Info" />
        <LoadingView />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Business Info" />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}
        bottomOffset={20}
      >
        <Field label="Nursery / Business Name" value={businessName} onChangeText={setBusinessName} testID="settings-business-name" />
        <Field label="Owner Name" value={ownerName} onChangeText={setOwnerName} testID="settings-owner-name" />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="settings-phone" />
        <Field label="Address" value={address} onChangeText={setAddress} testID="settings-address" />

        <View style={s.taxRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.taxLabel}>Charge Tax on bills?</Text>
            <Text style={s.taxHint}>Applied to all new bills</Text>
          </View>
          <Switch
            testID="settings-tax-switch"
            value={taxEnabled}
            onValueChange={setTaxEnabled}
            trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }}
            thumbColor="#FFFFFF"
          />
        </View>
        {taxEnabled && (
          <Field label="Tax %" placeholder="e.g. 5" value={taxPercent} onChangeText={setTaxPercent} keyboardType="numeric" testID="settings-tax-percent" />
        )}

        <Button title="Save Changes" icon="content-save" onPress={() => save.mutate()} disabled={!businessName.trim()} loading={save.isPending} testID="settings-save" style={{ marginTop: spacing.md }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  taxRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  taxLabel: { fontSize: 17, fontWeight: "600", color: colors.onSurface },
  taxHint: { fontSize: 14, color: colors.muted, marginTop: 2 },
}));
