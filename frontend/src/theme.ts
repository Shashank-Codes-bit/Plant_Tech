// Design tokens for NurseryPOS. Light theme only — max contrast for outdoor use.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#0B120C",
  surfaceSecondary: "#F2F5F3",
  onSurfaceSecondary: "#1A261D",
  surfaceTertiary: "#E4EBE5",
  onSurfaceTertiary: "#283B2C",
  surfaceInverse: "#162419",
  onSurfaceInverse: "#FFFFFF",
  muted: "#5C7563",

  brand: "#1B4D3E",
  onBrand: "#FFFFFF",
  brandPrimary: "#1B4D3E",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#4A7C59",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#D1E0D5",
  onBrandTertiary: "#1B4D3E",

  success: "#287D3C",
  onSuccess: "#FFFFFF",
  warning: "#D97706",
  onWarning: "#FFFFFF",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#1D4ED8",
  onInfo: "#FFFFFF",

  border: "#D4DDD6",
  borderStrong: "#A3B5A7",
  divider: "#E4EBE5",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
export const fontSize = { sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 32 };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
