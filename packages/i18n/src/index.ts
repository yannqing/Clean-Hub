export const supportedLocales = ["fr", "en"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];
