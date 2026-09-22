import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type IconName = React.ComponentProps<typeof MaterialDesignIcons>["name"];

// ------------------------------- Button --------------------------------
export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  size = "lg",
  disabled,
  loading,
  testID,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger" | "success";
  icon?: IconName;
  size?: "lg" | "md";
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useButtonStyles();
  const { colors } = useTheme();
  const bgMap: Record<string, string> = {
    primary: colors.brandPrimary,
    secondary: colors.brandTertiary,
    outline: colors.surface,
    danger: colors.error,
    success: colors.success,
  };
  const fgMap: Record<string, string> = {
    primary: colors.onBrandPrimary,
    secondary: colors.onBrandTertiary,
    outline: colors.onSurface,
    danger: colors.onError,
    success: colors.onSuccess,
  };
  const bg = disabled ? colors.surfaceTertiary : bgMap[variant];
  const fg = disabled ? colors.muted : fgMap[variant];

  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        s.btn,
        size === "md" && s.btnMd,
        { backgroundColor: bg },
        variant === "outline" && { borderWidth: 1.5, borderColor: colors.borderStrong },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={s.row}>
          {icon && <MaterialDesignIcons name={icon} size={size === "md" ? 20 : 24} color={fg} />}
          <Text style={[s.label, size === "md" && s.labelMd, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useButtonStyles = makeStyles(() => ({
  btn: {
    minHeight: 60,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnMd: { minHeight: 48 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: { fontSize: 20, fontWeight: "700" },
  labelMd: { fontSize: 16 },
}));

// ------------------------------- Card --------------------------------
export function Card({
  children,
  style,
  onPress,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}) {
  const s = useCardStyles();
  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[s.card, style]}>
      {children}
    </View>
  );
}

const useCardStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
}));

// ------------------------------- Stepper --------------------------------
export function Stepper({
  value,
  onChange,
  min = 0,
  testID,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  testID?: string;
}) {
  const s = useStepperStyles();
  const { colors } = useTheme();
  const press = (v: number) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(v);
  };
  return (
    <View style={s.wrap} testID={testID}>
      <Pressable
        testID={testID ? `${testID}-minus` : undefined}
        style={s.btn}
        onPress={() => press(Math.max(min, value - 1))}
      >
        <MaterialDesignIcons name="minus" size={22} color={colors.onSurface} />
      </Pressable>
      <Text style={s.value} testID={testID ? `${testID}-value` : undefined}>
        {value}
      </Text>
      <Pressable
        testID={testID ? `${testID}-plus` : undefined}
        style={s.btn}
        onPress={() => press(value + 1)}
      >
        <MaterialDesignIcons name="plus" size={22} color={colors.onSurface} />
      </Pressable>
    </View>
  );
}

const useStepperStyles = makeStyles((colors) => ({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
  },
  btn: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  value: { minWidth: 34, textAlign: "center", fontSize: 18, fontWeight: "700", color: colors.onSurface },
}));

// ------------------------------- Input Field --------------------------------
export function Field({
  label,
  testID,
  style,
  ...props
}: TextInputProps & { label?: string; testID?: string; style?: StyleProp<ViewStyle> }) {
  const s = useFieldStyles();
  const { colors } = useTheme();
  return (
    <View style={[s.wrap, style]}>
      {label && <Text style={s.label}>{label}</Text>}
      <TextInput
        testID={testID}
        placeholderTextColor={colors.muted}
        style={s.input}
        {...props}
      />
    </View>
  );
}

const useFieldStyles = makeStyles((colors) => ({
  wrap: { gap: 6 },
  label: { fontSize: 15, fontWeight: "600", color: colors.onSurfaceSecondary },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 54,
    fontSize: 17,
    color: colors.onSurface,
  },
}));

// ------------------------------- Chip --------------------------------
export function Chip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        height: 44,
        flexShrink: 0,
        paddingHorizontal: 18,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? colors.brandPrimary : colors.surfaceTertiary,
        borderWidth: 1,
        borderColor: active ? colors.brandPrimary : colors.border,
      }}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: "700",
          color: active ? colors.onBrandPrimary : colors.onSurfaceTertiary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ------------------------------- Stock badge --------------------------------
export function StockBadge({ stock, min }: { stock: number; min: number }) {
  const { colors } = useTheme();
  const low = stock <= min;
  const out = stock <= 0;
  const bg = out ? colors.error : low ? colors.warning : colors.brandTertiary;
  const fg = out ? colors.onError : low ? colors.onWarning : colors.onBrandTertiary;
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radius.sm,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: fg, fontWeight: "700", fontSize: 14 }}>
        {out ? "Out" : `${stock} left`}
      </Text>
    </View>
  );
}

// ------------------------------- Empty / Loading --------------------------------
export function LoadingView({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
      <ActivityIndicator size="large" color={colors.brandPrimary} />
      {label && <Text style={{ color: colors.muted, fontSize: 16 }}>{label}</Text>}
    </View>
  );
}

export function EmptyState({
  icon = "leaf",
  title,
  subtitle,
  action,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: colors.brandTertiary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialDesignIcons name={icon} size={44} color={colors.brandPrimary} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: "700", color: colors.onSurface, textAlign: "center" }}>
        {title}
      </Text>
      {subtitle && (
        <Text style={{ fontSize: 16, color: colors.muted, textAlign: "center" }}>{subtitle}</Text>
      )}
      {action}
    </View>
  );
}

export { MaterialDesignIcons as Icon };
