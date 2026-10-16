// Calendar days as "YYYY-MM-DD" (the India day the server files bills under). Maths is done in UTC on
// these keys, so the phone's own time zone can never shift a day.
import i18n from "i18next";

import { todayKey } from "@/src/format";

const pad = (n: number) => String(n).padStart(2, "0");
const locale = () => (i18n.language === "hi" ? "hi-IN" : "en-IN");

export const dayKey = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
export const toDate = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const addDays = (k: string, n: number) => {
  const d = toDate(k);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const mondayOf = (k: string) => addDays(k, -((toDate(k).getUTCDay() + 6) % 7));
export const monthStart = (k: string) => `${k.slice(0, 8)}01`;
export const monthEnd = (k: string) => {
  const d = toDate(monthStart(k));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
};
export const addMonths = (k: string, n: number) => {
  const d = toDate(monthStart(k));
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

const fmt = (k: string, o: Intl.DateTimeFormatOptions) => toDate(k).toLocaleDateString(locale(), { timeZone: "UTC", ...o });

// "Fri, 16 Oct 2026" / "Today" / "Yesterday"
export function dayLabelLong(k: string): string {
  if (k === todayKey()) return i18n.t("Today");
  if (k === todayKey(1)) return i18n.t("Yesterday");
  return fmt(k, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// "13–19 Oct 2026", "28 Sep – 4 Oct 2026", "16 Oct 2026"
export function rangeLabel(from: string, to: string): string {
  if (from === to) return fmt(from, { day: "numeric", month: "short", year: "numeric" });
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const a = fmt(from, sameMonth ? { day: "numeric" } : sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
  const b = fmt(to, { day: "numeric", month: "short", year: "numeric" });
  return sameMonth ? `${a}–${b}` : `${a} – ${b}`;
}

// "October 2026"
export const monthLabel = (k: string) => fmt(monthStart(k), { month: "long", year: "numeric" });
export const monthShort = (m0: number) => toDate(dayKey(2026, m0, 1)).toLocaleDateString(locale(), { timeZone: "UTC", month: "short" });
export const weekdayShort = (i: number) => fmt(addDays("2026-10-12", i), { weekday: "short" }); // 12 Oct 2026 is a Monday
