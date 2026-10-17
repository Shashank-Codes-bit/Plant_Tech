// Questions and notices, shown as the app's own sheet so they look the same everywhere
// (the browser's built-in pop-up is blocked in some previews, which made buttons look broken).
// <ConfirmHost /> sits once in app/_layout.tsx; anywhere else:
//   if (await confirm(...)) …                       yes / cancel
//   const pick = await choose(...)                  "yes" | "no" | null (closed), two named answers
//   await notice(...)                               one OK button
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Sheet } from "@/src/components/sheet";
import { Button, Icon, IconName, T } from "@/src/components/ui";
import { colors } from "@/src/theme";

type Answer = "yes" | "no" | null;
type Tone = "ask" | "danger" | "warn";
type Ask = { title: string; message: string; yes: string; no: string | null; tone: Tone; done: (a: Answer) => void };
let ask: ((a: Omit<Ask, "done">) => Promise<Answer>) | null = null;

const show = (a: Omit<Ask, "done">) => (ask ? ask(a) : Promise.resolve<Answer>(null));

export async function confirm(title: string, message: string, yes: string, destructive = false): Promise<boolean> {
  return (await show({ title, message, yes, no: "", tone: destructive ? "danger" : "ask" })) === "yes";
}

export function choose(title: string, message: string, yes: string, no: string): Promise<Answer> {
  return show({ title, message, yes, no, tone: "warn" });
}

export async function notice(title: string, message: string): Promise<void> {
  await show({ title, message, yes: "", no: null, tone: "warn" });
}

const ICON: Record<Tone, { name: IconName; color: string }> = {
  ask: { name: "help-circle-outline", color: colors.green },
  danger: { name: "alert-circle-outline", color: colors.red },
  warn: { name: "alert-circle-outline", color: colors.amber },
};

export function ConfirmHost() {
  const { t } = useTranslation();
  const [q, setQ] = useState<Ask | null>(null);

  useEffect(() => {
    ask = (a) => new Promise<Answer>((resolve) => setQ({ ...a, done: resolve }));
    return () => {
      ask = null;
    };
  }, []);

  const answer = (a: Answer) => {
    q?.done(a);
    setQ(null);
  };

  // no === "" means the usual Cancel; null means a notice with a single OK.
  return (
    <Sheet visible={!!q} onClose={() => answer(null)} title={q?.title} testID="confirm-sheet"
      footer={q && (
        <>
          <Button title={q.yes || t("OK")} icon={q.tone === "danger" ? "trash-can-outline" : q.tone === "ask" ? "check" : undefined}
            variant={q.tone === "danger" ? "danger" : "primary"} onPress={() => answer("yes")} testID="confirm-yes" />
          {q.no !== null && (
            <Button title={q.no || t("Cancel")} variant="outline" size="md" onPress={() => answer("no")} testID="confirm-no" />
          )}
        </>
      )}>
      {!!q && (
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <Icon name={ICON[q.tone].name} size={28} color={ICON[q.tone].color} />
          <T v="body" style={{ flex: 1 }}>{q.message}</T>
        </View>
      )}
    </Sheet>
  );
}
