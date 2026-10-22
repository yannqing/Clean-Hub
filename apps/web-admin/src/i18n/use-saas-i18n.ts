"use client";

import { formatWebAdminDate, formatWebAdminDateTime } from "./format";
import { useWebAdminLocale } from "./locale-provider";
import type { SaasMessages } from "./messages/saas";

export function useSaasI18n() {
  const { locale, messages } = useWebAdminLocale();

  return {
    locale,
    m: messages.saas,
    formatDate: (value: string) => formatWebAdminDate(locale, value),
    formatDateTime: (value: string) => formatWebAdminDateTime(locale, value),
  };
}

export type SaasI18n = {
  locale: ReturnType<typeof useWebAdminLocale>["locale"];
  m: SaasMessages;
  formatDate: (value: string) => string;
  formatDateTime: (value: string) => string;
};
