import {
  createTranslator,
  defaultLocale,
  hasMessage,
  type TranslationKey,
} from "@cleanhub/i18n";

import { getPosRuntimeLocale } from "@/components/i18n/pos-runtime-text";

type ActionResultLike = {
  code?: string;
  message: string;
};

/**
 * The user-facing message for a failed server action, in the cashier's
 * language.
 *
 * Server actions build `message` on the server, where the cashier's locale is
 * not known -- the runtime locale lives in a client module. So the Chinese
 * string the action produced reached every locale verbatim.
 *
 * The result also carries the backend `code`, which is locale-independent, so
 * the client can translate it here instead. The server `message` stays as the
 * fallback: it covers codes the catalogue does not carry yet and errors that
 * arrive without a code at all, which is better than showing nothing.
 *
 * `domain` selects the code table, because the same code means different
 * things per resource -- `INVALID_STATUS_TRANSITION` is about an order's
 * status in one and a ticket's in the other.
 */
export function getActionErrorMessage(
  result: ActionResultLike,
  domain: "order" | "ticket",
): string {
  if (!result.code) {
    return result.message;
  }

  const key = `pos.error.${domain}.${result.code}` as TranslationKey;
  const locale = getPosRuntimeLocale();
  if (!hasMessage(locale, key) && !hasMessage(defaultLocale, key)) {
    return result.message;
  }

  return createTranslator({ locale })(key);
}
