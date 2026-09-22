import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/ui";

export function Header({
  title,
  right,
  onBack,
}: {
  title: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[s.wrap, { paddingTop: insets.top + 8 }]}>
      <Pressable
        testID="header-back-button"
        style={s.back}
        onPress={() => (onBack ? onBack() : router.back())}
        hitSlop={10}
      >
        <Icon name="chevron-left" size={30} color={colors.onSurface} />
      </Pressable>
      <Text style={s.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={s.right}>{right}</View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 4,
  },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 22, fontWeight: "800", color: colors.onSurface },
  right: { flexDirection: "row", alignItems: "center", minWidth: 40, justifyContent: "flex-end" },
}));
