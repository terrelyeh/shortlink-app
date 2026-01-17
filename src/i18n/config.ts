export const locales = ["en", "zh-TW"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh-TW";

export const localeNames: Record<Locale, string> = {
  en: "English",
  "zh-TW": "繁體中文",
};
