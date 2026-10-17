// Choosing the app's language on this phone: a sheet (More → Language) and a compact pair for Welcome.
// Bills and the WhatsApp message to customers stay in English whatever is chosen here.
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { LANGUAGES, LanguageCode, setLanguage } from "@/src/i18n";
import { OptionRow, Sheet } from "@/src/components/sheet";
import { T } from "@/src/components/ui";
import { colors, radius, spacing } from "@/src/theme";

export function useLanguage() {
  const { i18n } = useTranslation();
  const code = (i18n.language === "hi" ? "hi" : "en") as LanguageCode;
  return { code, label: LANGUAGES.find((l) => l.code === code)!.label };
}

export function LanguageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { code } = useLanguage();
  return (
    <Sheet visible={visible} onClose={onClose} title={t("Language")} testID="language-sheet">
      {LANGUAGES.map((l) => (
        <OptionRow key={l.code} label={l.label} selected={code === l.code} testID={`language-${l.code}`}
          onPress={() => { setLanguage(l.code); onClose(); }} />
      ))}
      <T v="small">{t("Bills sent to customers stay in English.")}</T>
    </Sheet>
  );
}

// "English | हिन्दी" on the Welcome screen, before anyone has logged in.
export function LanguageToggle() {
  const { code } = useLanguage();
  return (
    <View style={{ flexDirection: "row", alignSelf: "center", padding: 3, borderRadius: radius.pill, backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.line }}>
      {LANGUAGES.map((l) => {
        const on = l.code === code;
        return (
          <Pressable key={l.code} onPress={() => setLanguage(l.code)} accessibilityRole="button" accessibilityState={{ selected: on }}
            testID={`welcome-language-${l.code}`}
            style={{ minHeight: 40, minWidth: 88, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: "center",
              justifyContent: "center", backgroundColor: on ? colors.green : "transparent" }}>
            <T v="bold" color={on ? colors.white : colors.inkSoft}>{l.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
