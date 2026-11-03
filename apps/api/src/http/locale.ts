import { defaultLocale, normalizeLocale, type SupportedLocale } from "@cleanhub/i18n/locales";

/**
 * The locale an API response should speak.
 *
 * The POS is the reason this exists. Its Kotlin client translates every string
 * it owns, but an error raised by the server arrived in English regardless of
 * the language the cashier picked -- so a French till could refuse a sale in
 * English, mid-queue.
 *
 * Read per request rather than stored per terminal: a terminal is shared, the
 * language is chosen at the PIN screen, and a handover changes it without the
 * server being told.
 */
export function resolveRequestLocale(
  acceptLanguage: string | null | undefined,
): SupportedLocale {
  if (!acceptLanguage) {
    return defaultLocale;
  }

  // Accept-Language is a weighted list: "fr-FR,fr;q=0.9,en;q=0.8". Take the
  // highest-weighted tag this API actually supports rather than the first tag,
  // which may be one it does not.
  const candidates = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...parameters] = part.trim().split(";");
      const quality = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith("q="));
      const weight = quality ? Number.parseFloat(quality.slice(2)) : 1;

      return {
        tag: tag?.trim() ?? "",
        // A malformed q= should not outrank a well-formed one.
        weight: Number.isFinite(weight) ? weight : 0,
      };
    })
    .filter((candidate) => candidate.tag.length > 0 && candidate.weight > 0)
    .sort((left, right) => right.weight - left.weight);

  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate.tag);
    if (locale) {
      return locale;
    }
  }

  return defaultLocale;
}
