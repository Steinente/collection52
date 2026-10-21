import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import de from "./locales/de.json";
import en from "./locales/en.json";
import { storageKeys } from "./client-config";

const saved = localStorage.getItem(storageKeys.language);
const browser = navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: saved ?? browser,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  localStorage.setItem(storageKeys.language, lng);
});
document.documentElement.lang = i18n.language;
export default i18n;
