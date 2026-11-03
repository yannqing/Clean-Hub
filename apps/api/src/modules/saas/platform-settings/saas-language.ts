export type SaasInterfaceLanguage = "en" | "fr" | "zh-CN";

export const saasLanguagePreferenceKey = "saasPreferredLanguage";

function isLanguage(value: unknown): value is SaasInterfaceLanguage {
  return value === "en" || value === "fr" || value === "zh-CN";
}

/** Explicit account choice wins; otherwise use the current platform default. */
export function resolveSaasInterfaceLanguage(
  profileLanguage: string | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
  platformDefault: string | null | undefined,
): SaasInterfaceLanguage {
  const preference = metadata?.[saasLanguagePreferenceKey];
  if (isLanguage(preference)) return preference;

  // Older non-English SaaS profiles represent an intentional choice. The old
  // default "en" cannot distinguish a preference from an untouched profile.
  if (profileLanguage === "fr" || profileLanguage === "zh-CN") {
    return profileLanguage;
  }
  return isLanguage(platformDefault) ? platformDefault : "en";
}
