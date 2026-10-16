// "Are you sure?" questions, shown as the app's own sheet so they look the same everywhere
// (the browser's built-in pop-up is blocked in some previews, which made buttons look broken).
// <ConfirmHost /> sits once in app/_layout.tsx; anywhere else: `if (await confirm(...)) …`.
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Sheet } from "@/src/components/sheet";
import { Button, Icon, T } from "@/src/components/ui";
import { colors } from "@/src/theme";

type Ask = { title: string; message: string; yes: string; destructive: boolean; done: (ok: boolean) => void };
let ask: ((a: Omit<Ask, "done">) => Promise<boolean>) | null = null;

export function confirm(title: string, message: string, yes: string, destructive = false): Promise<boolean> {
  return ask ? ask({ title, message, yes, destructive }) : Promise.resolve(false);
}

export function ConfirmHost() {
  const { t } = useTranslation();
  const [q, setQ] = useState<Ask | null>(null);

  useEffect(() => {
    ask = (a) => new Promise<boolean>((resolve) => setQ({ ...a, done: resolve }));
    return () => {
      ask = null;
    };
  }, []);

  const answer = (ok: boolean) => {
    q?.done(ok);
    setQ(null);
  };

  return (
    <Sheet visible={!!q} onClose={() => answer(false)} title={q?.title} testID="confirm-sheet"
      footer={q && (
        <>
          <Button title={q.yes} icon={q.destructive ? "trash-can-outline" : "check"} variant={q.destructive ? "danger" : "primary"}
            onPress={() => answer(true)} testID="confirm-yes" />
          <Button title={t("Cancel")} variant="outline" size="md" onPress={() => answer(false)} testID="confirm-no" />
        </>
      )}>
      {!!q && (
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <Icon name={q.destructive ? "alert-circle-outline" : "help-circle-outline"} size={28} color={q.destructive ? colors.red : colors.green} />
          <T v="body" style={{ flex: 1 }}>{q.message}</T>
        </View>
      )}
    </Sheet>
  );
}
