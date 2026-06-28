export const supportedLocales = ["fr", "en", "zh-CN"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = "fr";

export const localeLabels = {
  fr: "Français",
  en: "English",
  "zh-CN": "中文",
} as const satisfies Record<SupportedLocale, string>;

export const localeStorageKey = "cleanhub.mobile.locale";

const supportedLocaleSet = new Set<string>(supportedLocales);

export function isSupportedLocale(value: string): value is SupportedLocale {
  return supportedLocaleSet.has(value);
}

export function normalizeLocale(
  value: string | null | undefined,
): SupportedLocale | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace("_", "-");
  const lower = normalized.toLowerCase();

  if (lower === "zh" || lower === "zh-cn" || lower === "zh-hans") {
    return "zh-CN";
  }

  if (lower.startsWith("fr")) {
    return "fr";
  }

  if (lower.startsWith("en")) {
    return "en";
  }

  return isSupportedLocale(normalized) ? normalized : null;
}

export function resolveLocale(input: {
  userPreference?: string | null;
  tenantDefault?: string | null;
  deviceLocale?: string | null;
  defaultLocale?: SupportedLocale;
}): SupportedLocale {
  return (
    normalizeLocale(input.userPreference) ??
    normalizeLocale(input.tenantDefault) ??
    normalizeLocale(input.deviceLocale) ??
    input.defaultLocale ??
    defaultLocale
  );
}
