import { isSupportedLocale, type SupportedLocale } from "@cleanhub/i18n";

export type WebAdminLocale = Extract<SupportedLocale, "en" | "zh-CN">;

export const webAdminLocales = ["en", "zh-CN"] as const satisfies readonly WebAdminLocale[];

export const webAdminLocaleCookieName = "cleanhub_web_admin_locale";

export const webAdminDefaultLocale: WebAdminLocale = "en";

export function isWebAdminLocale(value: string): value is WebAdminLocale {
  return webAdminLocales.includes(value as WebAdminLocale);
}

export function parseWebAdminLocale(value: string | null | undefined): WebAdminLocale {
  if (!value) {
    return webAdminDefaultLocale;
  }

  if (isWebAdminLocale(value)) {
    return value;
  }

  if (isSupportedLocale(value) && value === "fr") {
    return webAdminDefaultLocale;
  }

  return webAdminDefaultLocale;
}
