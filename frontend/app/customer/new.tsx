import { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPost } from "@/src/api";
import { spacing, useTheme } from "@/src/theme";
import { Button, Field } from "@/src/components/ui";
import { Header } from "@/src/components/header";
import { useToast } from "@/src/components/toast";

export default function NewCustomer() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const save = useMutation({
    mutationFn: () =>
      apiPost("/customers", {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        notes: notes.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.show("Customer added", "success");
      router.back();
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="New Customer" />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}
        bottomOffset={20}
      >
        <Field label="Name" placeholder="Customer name" value={name} onChangeText={setName} testID="customer-name" />
        <Field label="Phone" placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="customer-phone" />
        <Field label="Email (optional)" placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" testID="customer-email" />
        <Field label="Address (optional)" placeholder="Address" value={address} onChangeText={setAddress} testID="customer-address" />
        <Field label="Notes (optional)" placeholder="Notes" value={notes} onChangeText={setNotes} testID="customer-notes" />
        <Button title="Save Customer" icon="content-save" onPress={() => save.mutate()} disabled={!name.trim()} loading={save.isPending} testID="customer-save" style={{ marginTop: spacing.md }} />
      </KeyboardAwareScrollView>
    </View>
  );
}
