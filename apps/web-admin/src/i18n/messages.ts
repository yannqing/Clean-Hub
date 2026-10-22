import type { WebAdminLocale } from "./locale";

export type { WebAdminMessages } from "./messages-types";

import { enMessages } from "./messages/en";
import type { WebAdminMessages } from "./messages-types";

/**
 * Synchronous default-locale (English) bundle.
 *
 * Always available — used as the SSR / first-paint fallback and as the initial
 * value of {@link WebAdminLocaleProvider}'s messages when the server hasn't
 * injected the active locale's bundle yet. Keeping this synchronous is what
 * lets the dozens of components consuming `useSaasI18n()` / `useWebAdminLocale`
 * continue to read message strings synchronously during render.
 */
export const webAdminDefaultMessages: WebAdminMessages = enMessages;

const webAdminMessagesCache = new Map<WebAdminLocale, WebAdminMessages>();
webAdminMessagesCache.set("en", enMessages);

/**
 * Load (and memoize) the message bundle for a locale.
 *
 * - `"en"` resolves synchronously from the eagerly-bundled default.
 * - Non-default locales are fetched through a dynamic `import()`, so their
 *   catalogs land in separate chunks and only ship to the client when the user
 *   actually switches to that locale.
 *
 * The server layout (`app/layout.tsx`) awaits this for the initial locale and
 * injects the result via `<WebAdminLocaleProvider initialMessages={...}>`, so
 * the very first paint already uses the correct locale without a flash. On the
 * client, {@link WebAdminLocaleProvider.setLocale} awaits this on switch and
 * keeps rendering the previous locale until the new chunk arrives.
 */
export async function getWebAdminMessages(
  locale: WebAdminLocale,
): Promise<WebAdminMessages> {
  const cached = webAdminMessagesCache.get(locale);

  if (cached) {
    return cached;
  }

  if (locale === "zh-CN") {
    const { zhCNMessages } = await import("./messages/zh-CN");
    webAdminMessagesCache.set(locale, zhCNMessages);
    return zhCNMessages;
  }

  if (locale === "fr") {
    const { frMessages } = await import("./messages/fr");
    webAdminMessagesCache.set(locale, frMessages);
    return frMessages;
  }

  // Unknown locales fall back to the default bundle (defensive — the locale is
  // narrowed by `WebAdminLocale`, but this keeps the function total).
  return enMessages;
}
