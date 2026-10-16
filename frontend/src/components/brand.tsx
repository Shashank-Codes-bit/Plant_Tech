// Hara Hisaab brand: the "Sprouting Rupee" mark (same shapes as assets/brand/*.svg) and the name.
// Used sparingly: Welcome / log in, Home when the shop has no logo, and the foot of More.
import { View } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";

import { T } from "@/src/components/ui";
import { colors } from "@/src/theme";

const LIME = "#9BDB8F";
const LEAF_ON_LIGHT = "#3F9C5E";

function Mark({ leaf, rupee }: { leaf: string; rupee: string }) {
  return (
    <>
      <Path d="M60 50 V31" stroke={leaf} strokeWidth={6} strokeLinecap="round" />
      <Path d="M60 35 C49 35 41 29 39 18 C50 18 58 24 60 35 Z" fill={leaf} />
      <Path d="M60 31 C62 19 72 12 85 12 C83 24 73 31 60 31 Z" fill={leaf} />
      <Path d="M36 50 H84 M36 64 H84 M50 50 C77 50 77 78 50 78 H40 L75 106" fill="none" stroke={rupee} strokeWidth={9}
        strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

// The app icon: the mark on brand green, rounded.
export function BrandIcon({ size = 52 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityLabel="Hara Hisaab">
      <Rect width={120} height={120} rx={28} fill={colors.green} />
      <G transform="translate(60 60) scale(0.8) translate(-60 -59)">
        <Mark leaf={LIME} rupee={colors.white} />
      </G>
    </Svg>
  );
}

// The mark alone, for light backgrounds.
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityLabel="Hara Hisaab">
      <Mark leaf={LEAF_ON_LIGHT} rupee={colors.green} />
    </Svg>
  );
}

// हरा हिसाब / Hara Hisaab, stacked.
export function BrandName({ big }: { big?: boolean }) {
  return (
    <View style={{ alignItems: "center" }}>
      <T v="heading" style={{ fontSize: big ? 44 : 30, lineHeight: big ? 54 : 38, color: colors.greenDark }}>हरा हिसाब</T>
      <T v="bold" style={{ fontSize: big ? 22 : 17, letterSpacing: 0.4 }}>Hara Hisaab</T>
    </View>
  );
}
