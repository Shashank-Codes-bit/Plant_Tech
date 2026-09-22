import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost } from "@/src/api";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, Icon, LoadingView } from "@/src/components/ui";
import { Header } from "@/src/components/header";
import { useToast } from "@/src/components/toast";

export default function Categories() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState("");

  const categories = useQuery({ queryKey: ["categories"], queryFn: () => apiGet("/categories") });

  const add = useMutation({
    mutationFn: () => apiPost("/categories", { name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setName("");
      toast.show("Category added", "success");
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Categories" />
      <View style={s.addRow}>
        <TextInput
          testID="category-input"
          value={name}
          onChangeText={setName}
          placeholder="New category name"
          placeholderTextColor={colors.muted}
          style={s.input}
        />
        <Button title="Add" icon="plus" size="md" onPress={() => add.mutate()} disabled={!name.trim()} loading={add.isPending} testID="category-add" />
      </View>

      {categories.isLoading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={categories.data}
          keyExtractor={(c: any) => c.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.sm }}
          renderItem={({ item }) => (
            <View style={s.row} testID={`category-${item.name}`}>
              <Icon name="shape" size={22} color={colors.brandPrimary} />
              <Text style={s.name}>{item.name}</Text>
              <Pressable onPress={() => remove.mutate(item.id)} hitSlop={8} testID={`category-delete-${item.name}`}>
                <Icon name="trash-can-outline" size={22} color={colors.error} />
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  addRow: { flexDirection: "row", gap: spacing.md, padding: spacing.lg, alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 54,
    fontSize: 17,
    color: colors.onSurface,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.onSurface },
}));
