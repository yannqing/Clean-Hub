"use client";

import { formatWebAdminDate, formatWebAdminDateTime } from "./format";
import { useWebAdminLocale } from "./locale-provider";
import type { SaasMessages } from "./messages/saas";
import {
  getSaasFeedbackTranslator,
  type SaasFeedbackTranslator,
} from "./saas-feedback";

export function useSaasI18n() {
  const { locale, messages } = useWebAdminLocale();

  return {
    locale,
    m: messages.saas,
    feedback: getSaasFeedbackTranslator(locale, messages),
    formatDate: (value: string) => formatWebAdminDate(locale, value),
    formatDateTime: (value: string) => formatWebAdminDateTime(locale, value),
  };
}

export type SaasI18n = {
  locale: ReturnType<typeof useWebAdminLocale>["locale"];
  m: SaasMessages;
  feedback: SaasFeedbackTranslator;
  formatDate: (value: string) => string;
  formatDateTime: (value: string) => string;
};
