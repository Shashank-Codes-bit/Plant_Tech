// Design tokens for Hara Hisaab (matches the approved prototype).
// Light theme only, high contrast for outdoor use. Touch targets >= 56. Baloo 2 for headings and
// money, Mukta for text: both cover Latin and Devanagari, so Hindi needs no font change.

import { useMemo } from "react";
import { StyleSheet, TextStyle } from "react-native";

export const colors = {
  page: "#F5F8F5",
  surface: "#FFFFFF",
  ink: "#10201A",
  inkSoft: "#3E5248",
  muted: "#4B5F55",
  line: "#D6E2D9",
  lineStrong: "#C7D6CC",

  green: "#1B5E3B",
  greenDark: "#134A2E",
  greenMid: "#2D7A50",
  greenTint: "#E8F2EA",
  greenOnDark: "#D5E9DB",

  blue: "#1D4ED8",
  blueTint: "#EEF2FF",
  blueInk: "#1E3A8A",

  amber: "#B45309",
  amberTint: "#FFFBEB",
  amberInk: "#7C3A06",

  red: "#B91C1C",
  redLine: "#F3C9C9",

  whatsapp: "#128C4A",
  white: "#FFFFFF",
};

export type ThemeColors = typeof colors;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32 };
export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };
export const touch = { min: 56, large: 64, primary: 68 };

export const fonts = {
  display: "Baloo2_800ExtraBold",
  displayBold: "Baloo2_700Bold",
  regular: "Mukta_400Regular",
  semibold: "Mukta_600SemiBold",
  bold: "Mukta_700Bold",
  extrabold: "Mukta_800ExtraBold",
};

export const type = {
  amount: { fontFamily: fonts.display, fontSize: 44, lineHeight: 50, color: colors.greenDark },
  heading: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink },
  number: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink },
  bodyLarge: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 26, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 25, color: colors.ink },
  bold: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 25, color: colors.ink },
  label: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.inkSoft },
  small: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted },
  caption: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.muted },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof type;

export function useTheme() {
  return { colors };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (c: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    return useMemo(() => StyleSheet.create(factory(colors)), []);
  };
}
