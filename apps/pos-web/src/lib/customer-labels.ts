import {
  createTranslator,
  defaultLocale,
  hasMessage,
  type TranslationKey,
} from "@cleanhub/i18n";

import { getPosRuntimeLocale } from "@/components/i18n/pos-runtime-text";

/**
 * Customer vocabulary. Same shape and the same reasons as `order-labels.ts`.
 */
function label(key: TranslationKey, rawValue: string): string {
  const locale = getPosRuntimeLocale();
  if (!hasMessage(locale, key) && !hasMessage(defaultLocale, key)) {
    return rawValue;
  }
  return createTranslator({ locale })(key);
}

export function getCustomerColumnLabel(column: string): string {
  return label(`pos.customer.column.${column}` as TranslationKey, column);
}

export function getCustomerStateLabel(status: "active" | "disabled"): string {
  return label(`pos.customer.state.${status}`, status);
}
