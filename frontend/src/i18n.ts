// Translations. The English text is the key: t("New order"). English needs no file;
// another language (e.g. Hindi) is one map of English sentence -> translation in `resources`.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";

import { storage } from "@/src/utils/storage";

export const LANGUAGES = [{ code: "en", label: "English" }] as const;
const LANG_KEY = "nurserypos_language_v1";

const resources = {
  en: { translation: {} },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

// Saved choice first, else the phone's language if we have it, else English.
(async () => {
  const saved = await storage.getItem<string | null>(LANG_KEY, null);
  const device = getLocales()[0]?.languageCode ?? "en";
  const pick = [saved, device].find((l) => l && l in resources);
  if (pick && pick !== i18n.language) i18n.changeLanguage(pick);
})();

export async function setLanguage(code: string) {
  await i18n.changeLanguage(code);
  await storage.setItem(LANG_KEY, code);
}

export default i18n;
