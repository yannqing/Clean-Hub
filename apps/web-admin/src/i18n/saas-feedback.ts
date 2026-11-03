import type { WebAdminLocale } from "./locale";
import type { WebAdminMessages } from "./messages-types";
import { getWebAdminFeedbackTranslator, type FeedbackTranslator } from "./feedback";

export type SaasFeedbackTranslator = FeedbackTranslator;
export function getSaasFeedbackTranslator(locale: WebAdminLocale, messages: WebAdminMessages): SaasFeedbackTranslator {
  return getWebAdminFeedbackTranslator(locale, messages, "saas");
}
