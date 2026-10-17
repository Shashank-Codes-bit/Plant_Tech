// Translations. The English text is the key: t("New order"). English needs no file; Hindi is one map of
// English sentence -> translation in src/locales/hi.json (npm run i18n:check finds anything missing).
// The app starts in English; a phone keeps the language chosen on it (More → Language, or Welcome).
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import hi from "@/src/locales/hi.json";
import { storage } from "@/src/utils/storage";

export const LANGUAGES = [{ code: "en", label: "English" }, { code: "hi", label: "हिन्दी" }] as const;
export type LanguageCode = (typeof LANGUAGES)[number]["code"];
const LANG_KEY = "nurserypos_language_v1";

const resources = {
  en: { translation: {} },
  hi: { translation: hi },
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

(async () => {
  const saved = await storage.getItem<string | null>(LANG_KEY, null);
  if (saved && saved in resources && saved !== i18n.language) i18n.changeLanguage(saved);
})();

export async function setLanguage(code: LanguageCode) {
  await i18n.changeLanguage(code);
  await storage.setItem(LANG_KEY, code);
}

export default i18n;
