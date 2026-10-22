import {
  createTranslator,
  defaultLocale,
  hasMessage,
  type TranslationKey,
} from "@cleanhub/i18n";

import { getPosRuntimeLocale } from "@/components/i18n/pos-runtime-text";

/**
 * A catalogue label with a raw-value fallback, for one-off lookups.
 *
 * The domain modules (`order-labels.ts`, `ticket-labels.ts`, …) each keep a
 * private copy of this; this is the same thing for the handful of call sites
 * that need one label and do not warrant a module. Resolved per call so the
 * wording follows a language switch.
 */
export function getCatalogueLabel(
  key: TranslationKey,
  rawValue: string,
): string {
  const locale = getPosRuntimeLocale();
  if (!hasMessage(locale, key) && !hasMessage(defaultLocale, key)) {
    return rawValue;
  }
  return createTranslator({ locale })(key);
}
