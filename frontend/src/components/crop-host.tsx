// The crop screen shown after every photo: the picture with a frame to drag (corners, edges, or the
// whole frame), and only two choices: Retake or Use photo. <CropHost /> sits once in app/_layout.tsx;
// useImageCapture calls cropImage(). Square crops (aspect 1) keep their shape and show corners only.
import { useEffect, useState } from "react";
import { LayoutChangeEvent, Modal, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { SharedValue, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Button, Icon, T } from "@/src/components/ui";
import type { Picked, Rect } from "@/src/image-tools";
import { colors, spacing, touch } from "@/src/theme";

export type CropOptions = { aspect?: number; title?: string; hint?: string; secondary?: string };
export type CropAnswer = { kind: "use"; rect: Rect } | { kind: "retake" } | { kind: "cancel" };
type Job = CropOptions & { image: Picked; done: (a: CropAnswer) => void };

let open: ((j: Omit<Job, "done">) => Promise<CropAnswer>) | null = null;

export function cropImage(image: Picked, options: CropOptions = {}): Promise<CropAnswer> {
  const whole: CropAnswer = { kind: "use", rect: { x: 0, y: 0, width: image.width, height: image.height } };
  return open ? open({ image, ...options }) : Promise.resolve(whole);
}

export function CropHost() {
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    open = (j) => new Promise<CropAnswer>((resolve) => setJob({ ...j, done: resolve }));
    return () => {
      open = null;
    };
  }, []);

  const answer = (a: CropAnswer) => {
    job?.done(a);
    setJob(null);
  };

  return (
    <Modal visible={!!job} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => answer({ kind: "cancel" })}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {job && <CropView key={job.image.uri} job={job} onAnswer={answer} />}
      </GestureHandlerRootView>
    </Modal>
  );
}

const MIN = 72; // smallest frame side on screen
const HIT = 44; // touch area of a handle
const DARK = "#0E1A14";
const OUTLINE = "rgba(14,26,20,0.6)";

function clamp(v: number, lo: number, hi: number) {
  "worklet";
  return Math.min(Math.max(v, lo), hi);
}

type Box = { x: number; y: number; w: number; h: number };
type Side = { l?: boolean; r?: boolean; t?: boolean; b?: boolean };

function CropView({ job, onAnswer }: { job: Job; onAnswer: (a: CropAnswer) => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { image, aspect } = job;
  // Where the picture sits inside the dark area (it is shown whole, letterboxed).
  const [fit, setFit] = useState<{ ox: number; oy: number; w: number; h: number; scale: number } | null>(null);
  const fx = useSharedValue(0);
  const fy = useSharedValue(0);
  const fw = useSharedValue(0);
  const fh = useSharedValue(0);
  const bw = useSharedValue(0);
  const bh = useSharedValue(0);
  const start = useSharedValue<Box>({ x: 0, y: 0, w: 0, h: 0 });

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    const pad = 20;
    const scale = Math.min((width - pad * 2) / image.width, (height - pad * 2) / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    setFit({ ox: (width - w) / 2, oy: (height - h) / 2, w, h, scale });
    bw.value = w;
    bh.value = h;
    // Start on the whole picture (or the largest centred square), so one tap on Use photo is enough.
    const fw0 = aspect ? Math.min(w, h * aspect) : w;
    const fh0 = aspect ? fw0 / aspect : h;
    fx.value = (w - fw0) / 2;
    fy.value = (h - fh0) / 2;
    fw.value = fw0;
    fh.value = fh0;
  }

  const begin = () => {
    "worklet";
    start.value = { x: fx.value, y: fy.value, w: fw.value, h: fh.value };
  };

  const resize = (side: Side) => Gesture.Pan().minDistance(0).onBegin(begin).onUpdate((e) => {
    const s = start.value;
    if (aspect) {
      // Corner of a fixed-shape frame: the opposite corner stays put.
      const ax = side.l ? s.x + s.w : s.x;
      const ay = side.t ? s.y + s.h : s.y;
      const roomW = side.l ? ax : bw.value - ax;
      const roomH = side.t ? ay : bh.value - ay;
      const w = clamp(s.w + (side.l ? -e.translationX : e.translationX), MIN, Math.min(roomW, roomH * aspect));
      const h = w / aspect;
      fx.value = side.l ? ax - w : ax;
      fy.value = side.t ? ay - h : ay;
      fw.value = w;
      fh.value = h;
      return;
    }
    let left = s.x;
    let top = s.y;
    let right = s.x + s.w;
    let bottom = s.y + s.h;
    if (side.l) left = clamp(s.x + e.translationX, 0, right - MIN);
    if (side.r) right = clamp(s.x + s.w + e.translationX, left + MIN, bw.value);
    if (side.t) top = clamp(s.y + e.translationY, 0, bottom - MIN);
    if (side.b) bottom = clamp(s.y + s.h + e.translationY, top + MIN, bh.value);
    fx.value = left;
    fy.value = top;
    fw.value = right - left;
    fh.value = bottom - top;
  });

  const move = Gesture.Pan().onBegin(begin).onUpdate((e) => {
    const s = start.value;
    fx.value = clamp(s.x + e.translationX, 0, bw.value - s.w);
    fy.value = clamp(s.y + e.translationY, 0, bh.value - s.h);
  });

  function use() {
    if (!fit) return;
    onAnswer({ kind: "use", rect: { x: fx.value / fit.scale, y: fy.value / fit.scale, width: fw.value / fit.scale, height: fh.value / fit.scale } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: DARK }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: spacing.sm, flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Close")} testID="crop-close" onPress={() => onAnswer({ kind: "cancel" })}
          style={{ width: touch.min, height: touch.min, alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={28} color={colors.white} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T v="bodyLarge" color={colors.white}>{job.title ?? t("Crop photo")}</T>
          <T v="caption" color={colors.greenOnDark}>{job.hint ?? t("Drag the corners to frame the item")}</T>
        </View>
      </View>

      <View style={{ flex: 1 }} onLayout={onLayout}>
        {fit && (
          <View style={{ position: "absolute", left: fit.ox, top: fit.oy, width: fit.w, height: fit.h }}>
            <Image source={{ uri: image.uri }} style={{ width: fit.w, height: fit.h }} contentFit="fill" />
            <Shade fx={fx} fy={fy} fw={fw} fh={fh} bw={bw} bh={bh} />
            <GestureDetector gesture={move}>
              <Frame fx={fx} fy={fy} fw={fw} fh={fh} />
            </GestureDetector>
            {(aspect ? CORNERS : [...CORNERS, ...EDGES]).map((side) => (
              <GestureDetector key={sideKey(side)} gesture={resize(side)}>
                <Handle side={side} fx={fx} fy={fy} fw={fw} fh={fh} />
              </GestureDetector>
            ))}
          </View>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 12, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, backgroundColor: colors.surface,
        borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
        <Button title={job.secondary ?? t("Retake")} icon={job.secondary ? undefined : "camera-retake-outline"} variant="outline" size="md"
          style={{ flex: 1 }} onPress={() => onAnswer({ kind: "retake" })} testID="crop-retake" />
        <Button title={t("Use photo")} icon="check" size="md" style={{ flex: 1.4 }} onPress={use} disabled={!fit} testID="crop-use" />
      </View>
    </View>
  );
}

const CORNERS: Side[] = [{ l: true, t: true }, { r: true, t: true }, { l: true, b: true }, { r: true, b: true }];
const EDGES: Side[] = [{ t: true }, { b: true }, { l: true }, { r: true }];
const sideKey = (s: Side) => `${s.l ? "l" : ""}${s.r ? "r" : ""}${s.t ? "t" : ""}${s.b ? "b" : ""}`;

type Frame4 = { fx: SharedValue<number>; fy: SharedValue<number>; fw: SharedValue<number>; fh: SharedValue<number> };

// The dimmed picture outside the frame.
function Shade({ fx, fy, fw, fh, bw, bh }: Frame4 & { bw: SharedValue<number>; bh: SharedValue<number> }) {
  const dim = { position: "absolute" as const, backgroundColor: "rgba(14,26,20,0.62)" };
  const top = useAnimatedStyle(() => ({ left: 0, top: 0, width: bw.value, height: fy.value }));
  const bottom = useAnimatedStyle(() => ({ left: 0, top: fy.value + fh.value, width: bw.value, height: bh.value - fy.value - fh.value }));
  const left = useAnimatedStyle(() => ({ left: 0, top: fy.value, width: fx.value, height: fh.value }));
  const right = useAnimatedStyle(() => ({ left: fx.value + fw.value, top: fy.value, width: bw.value - fx.value - fw.value, height: fh.value }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[dim, top]} />
      <Animated.View pointerEvents="none" style={[dim, bottom]} />
      <Animated.View pointerEvents="none" style={[dim, left]} />
      <Animated.View pointerEvents="none" style={[dim, right]} />
    </>
  );
}

// The frame itself: a white line with a dark edge (visible on a white bill and a dark photo alike)
// and faint thirds; dragged to move.
function Frame({ fx, fy, fw, fh }: Frame4) {
  const box = useAnimatedStyle(() => ({ left: fx.value, top: fy.value, width: fw.value, height: fh.value }));
  const line = { position: "absolute" as const, backgroundColor: "rgba(255,255,255,0.45)" };
  return (
    <Animated.View testID="crop-frame" style={[{ position: "absolute", borderWidth: 1, borderColor: OUTLINE }, box]}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderWidth: 1.5, borderColor: colors.white }} />
      <View pointerEvents="none" style={[line, { left: "33.33%", top: 0, bottom: 0, width: 1 }]} />
      <View pointerEvents="none" style={[line, { left: "66.66%", top: 0, bottom: 0, width: 1 }]} />
      <View pointerEvents="none" style={[line, { top: "33.33%", left: 0, right: 0, height: 1 }]} />
      <View pointerEvents="none" style={[line, { top: "66.66%", left: 0, right: 0, height: 1 }]} />
    </Animated.View>
  );
}

// A corner (L-shaped) or edge (short bar) handle with a 44 px touch area centred on the frame line.
function Handle({ side, fx, fy, fw, fh }: Frame4 & { side: Side }) {
  const corner = (side.l || side.r) && (side.t || side.b);
  const pos = useAnimatedStyle(() => {
    const cx = side.l ? fx.value : side.r ? fx.value + fw.value : fx.value + fw.value / 2;
    const cy = side.t ? fy.value : side.b ? fy.value + fh.value : fy.value + fh.value / 2;
    return { left: cx - HIT / 2, top: cy - HIT / 2 };
  });
  const bar = { position: "absolute" as const, backgroundColor: colors.white, borderRadius: 2, borderWidth: 1, borderColor: OUTLINE };
  const LEN = 24;
  const W = 6;
  const half = HIT / 2;
  return (
    <Animated.View testID={`crop-handle-${sideKey(side)}`} style={[{ position: "absolute", width: HIT, height: HIT }, pos]}>
      {corner ? (
        <>
          <View pointerEvents="none" style={[bar, { width: LEN, height: W, top: half - W / 2, left: side.l ? half - W / 2 : half - LEN + W / 2 }]} />
          <View pointerEvents="none" style={[bar, { width: W, height: LEN, left: half - W / 2, top: side.t ? half - W / 2 : half - LEN + W / 2 }]} />
        </>
      ) : side.t || side.b ? (
        <View pointerEvents="none" style={[bar, { width: 30, height: W, left: half - 15, top: half - W / 2 }]} />
      ) : (
        <View pointerEvents="none" style={[bar, { width: W, height: 30, top: half - 15, left: half - W / 2 }]} />
      )}
    </Animated.View>
  );
}
