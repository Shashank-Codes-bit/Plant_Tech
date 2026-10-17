// Date pickers in a sheet: one day, a whole week (Monday to Sunday), or a from–to range; and a month picker.
// Days after `max` (default today) can't be picked.
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Sheet } from "@/src/components/sheet";
import { Button, Icon, MAX_FONT_SCALE, T } from "@/src/components/ui";
import { addDays, addMonths, dayKey, mondayOf, monthLabel, monthShort, monthStart, rangeLabel, toDate, weekdayShort } from "@/src/dates";
import { todayKey } from "@/src/format";
import { colors, fonts, radius, spacing } from "@/src/theme";

export type Range = { from: string; to: string };

function MonthNav({ label, onPrev, onNext, canNext }: { label: string; onPrev: () => void; onNext: () => void; canNext: boolean }) {
  const { t } = useTranslation();
  const btn = { width: 52, height: 52, borderRadius: 26, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: colors.page };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <Pressable accessibilityLabel={t("Earlier")} onPress={onPrev} style={btn} testID="cal-prev">
        <Icon name="chevron-left" size={30} color={colors.ink} />
      </Pressable>
      <T v="bodyLarge" style={{ flex: 1, textAlign: "center" }}>{label}</T>
      <Pressable accessibilityLabel={t("Later")} onPress={onNext} disabled={!canNext} style={[btn, { opacity: canNext ? 1 : 0.35 }]} testID="cal-next">
        <Icon name="chevron-right" size={30} color={colors.ink} />
      </Pressable>
    </View>
  );
}

export function CalendarSheet({ visible, onClose, title, mode, initial, max, onPick }: {
  visible: boolean; onClose: () => void; title: string; mode: "day" | "week" | "range";
  initial?: Range; max?: string; onPick: (r: Range) => void;
}) {
  const { t } = useTranslation();
  const last = max ?? todayKey();
  const [month, setMonth] = useState(monthStart(initial?.from ?? last));
  const [sel, setSel] = useState<Range | null>(initial ?? null);
  const [half, setHalf] = useState(false); // range: start picked, waiting for the end

  const first = toDate(month);
  const lead = (first.getUTCDay() + 6) % 7; // blanks before the 1st (weeks start on Monday)
  const days = toDate(addDays(addMonths(month, 1), -1)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => dayKey(first.getUTCFullYear(), first.getUTCMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);

  function tap(k: string) {
    if (mode === "day") {
      onPick({ from: k, to: k });
      onClose();
    } else if (mode === "week") {
      const from = mondayOf(k);
      onPick({ from, to: addDays(from, 6) });
      onClose();
    } else if (!half || !sel) {
      setSel({ from: k, to: k });
      setHalf(true);
    } else {
      setSel(k < sel.from ? { from: k, to: sel.from } : { from: sel.from, to: k });
      setHalf(false);
    }
  }

  const shown = mode === "range" ? sel : initial;
  return (
    <Sheet visible={visible} onClose={onClose} title={title}
      footer={mode === "range" ? (
        <Button title={sel ? t("Show {{range}}", { range: rangeLabel(sel.from, sel.to) }) : t("Pick the first day")} icon="check"
          disabled={!sel} onPress={() => { if (sel) { onPick(sel); onClose(); } }} testID="cal-apply" />
      ) : undefined}>
      {mode === "range" && <T v="small">{half ? t("Now tap the last day") : t("Tap the first day, then the last day")}</T>}
      {mode === "week" && <T v="small">{t("Tap any day to pick its week (Monday to Sunday)")}</T>}
      <MonthNav label={monthLabel(month)} onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))}
        canNext={addMonths(month, 1) <= last} />
      <View style={{ flexDirection: "row" }}>
        {Array.from({ length: 7 }, (_, i) => (
          <T key={i} v="caption" style={{ flex: 1, textAlign: "center" }}>{weekdayShort(i)}</T>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((k, i) => {
          if (!k) return <View key={i} style={{ width: `${100 / 7}%`, height: 48 }} />;
          const off = k > last;
          const inSel = !!shown && k >= shown.from && k <= shown.to;
          const edge = !!shown && (k === shown.from || k === shown.to);
          return (
            <Pressable key={k} disabled={off} onPress={() => tap(k)} testID={`cal-${k}`}
              style={{ width: `${100 / 7}%`, height: 48, alignItems: "center", justifyContent: "center",
                backgroundColor: inSel && !edge ? colors.greenTint : "transparent" }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
                backgroundColor: edge ? colors.green : "transparent", borderWidth: k === todayKey() && !edge ? 2 : 0, borderColor: colors.green }}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE}
                  style={{ fontFamily: fonts.bold, fontSize: 17, color: edge ? colors.white : off ? colors.lineStrong : colors.ink }}>
                  {Number(k.slice(8))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

export function MonthSheet({ visible, onClose, value, max, onPick }: {
  visible: boolean; onClose: () => void; value: string; max?: string; onPick: (monthStartKey: string) => void;
}) {
  const { t } = useTranslation();
  const last = monthStart(max ?? todayKey());
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  return (
    <Sheet visible={visible} onClose={onClose} title={t("Pick a month")}>
      <MonthNav label={String(year)} onPrev={() => setYear(year - 1)} onNext={() => setYear(year + 1)} canNext={`${year + 1}-01-01` <= last} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
        {Array.from({ length: 12 }, (_, m) => {
          const k = dayKey(year, m, 1);
          const off = k > last;
          const on = k === monthStart(value);
          return (
            <Pressable key={k} disabled={off} testID={`month-${k.slice(0, 7)}`}
              onPress={() => { onPick(k); onClose(); }}
              style={{ width: "30%", flexGrow: 1, minHeight: 56, borderRadius: radius.md, alignItems: "center", justifyContent: "center",
                borderWidth: 2, borderColor: on ? colors.green : colors.line, backgroundColor: on ? colors.green : colors.surface, opacity: off ? 0.35 : 1 }}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={{ fontFamily: fonts.bold, fontSize: 17, color: on ? colors.white : colors.ink }}>
                {monthShort(m)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
