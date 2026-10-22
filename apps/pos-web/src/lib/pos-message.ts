import {
  createTranslator,
  type TranslationKey,
  type TranslationParams,
} from "@cleanhub/i18n";

import { getPosRuntimeLocale } from "@/components/i18n/pos-runtime-text";

/**
 * Catalogue text for code that runs outside a React component.
 *
 * Toasts are fired from event handlers and async callbacks, where the
 * `useTranslation` hook is not available. Those call sites used to build the
 * sentence with a template literal, which meant the Chinese wording was
 * compiled in and a French cashier saw it verbatim.
 *
 * Reads the locale at call time rather than at module load, so a language
 * switch applies to the next toast without a reload.
 */
export function posMessage(
  key: TranslationKey,
  params?: TranslationParams,
): string {
  return createTranslator({ locale: getPosRuntimeLocale() })(key, params);
}
