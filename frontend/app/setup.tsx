import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPost } from "@/src/api";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { Button, Field } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";

const HERO =
  "https://images.unsplash.com/photo-1785964165816-95e058839a26?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzl8MHwxfHNlYXJjaHwxfHxzdW5saWdodCUyMGdyZWVuaG91c2UlMjBwbGFudCUyMG51cnNlcnl8ZW58MHx8fHwxNzkwMTA3NzY5fDA&ixlib=rb-4.1.0&q=85";

export default function Setup() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxPercent, setTaxPercent] = useState("");

  const save = useMutation({
    mutationFn: () =>
      apiPost("/business", {
        business_name: businessName.trim(),
        owner_name: ownerName.trim(),
        phone: phone.trim(),
        currency: "₹",
        tax_enabled: taxEnabled,
        tax_percent: taxEnabled ? Number(taxPercent) || 0 : 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business"] });
      router.replace("/(tabs)");
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      bottomOffset={20}
    >
      <Image source={{ uri: HERO }} style={s.hero} contentFit="cover" />
      <View style={s.body}>
        <Text style={s.title}>Welcome 🌿</Text>
        <Text style={s.subtitle}>Set up your nursery to start billing in seconds.</Text>

        <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
          <Field
            label="Nursery / Business Name"
            placeholder="Green Leaf Nursery"
            value={businessName}
            onChangeText={setBusinessName}
            testID="setup-business-name"
          />
          <Field
            label="Owner Name"
            placeholder="Your name"
            value={ownerName}
            onChangeText={setOwnerName}
            testID="setup-owner-name"
          />
          <Field
            label="Phone"
            placeholder="Contact number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            testID="setup-phone"
          />

          <View style={s.taxRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.taxLabel}>Charge Tax on bills?</Text>
              <Text style={s.taxHint}>Optional — off by default</Text>
            </View>
            <Switch
              testID="setup-tax-switch"
              value={taxEnabled}
              onValueChange={setTaxEnabled}
              trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }}
              thumbColor="#FFFFFF"
            />
          </View>
          {taxEnabled && (
            <Field
              label="Tax %"
              placeholder="e.g. 5"
              value={taxPercent}
              onChangeText={setTaxPercent}
              keyboardType="numeric"
              testID="setup-tax-percent"
            />
          )}
        </View>

        <Button
          title="Start Selling"
          icon="arrow-right"
          onPress={() => save.mutate()}
          disabled={!businessName.trim()}
          loading={save.isPending}
          testID="setup-submit"
          style={{ marginTop: spacing["2xl"] }}
        />
      </View>
    </KeyboardAwareScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  hero: { width: "100%", height: 220 },
  body: { paddingHorizontal: spacing.xl, marginTop: spacing.xl },
  title: { fontSize: 32, fontWeight: "800", color: colors.onSurface },
  subtitle: { fontSize: 17, color: colors.muted, marginTop: 4 },
  taxRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: spacing.lg,
  },
  taxLabel: { fontSize: 17, fontWeight: "600", color: colors.onSurface },
  taxHint: { fontSize: 14, color: colors.muted, marginTop: 2 },
}));
