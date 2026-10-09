"use client";

import { formatWebAdminDate, formatWebAdminDateTime } from "./format";
import { useWebAdminLocale } from "./locale-provider";
import type { TenantMessages } from "./messages/tenant";
import { useTenantTimeZone } from "./tenant-timezone-provider";

/**
 * 租户域（/tenant/**）的 i18n hook，镜像 use-saas-i18n()。
 *
 * 返回 { locale, m, formatDate, formatDateTime }，其中 m 是 messages.tenant 子树。
 * 切换语言时由 WebAdminLocaleProvider 驱动重渲染。
 */
export function useTenantI18n() {
  const { locale, messages } = useWebAdminLocale();
  const timeZone = useTenantTimeZone();

  return {
    locale,
    timeZone,
    m: messages.tenant,
    formatDate: (value: string) => formatWebAdminDate(locale, value, undefined, timeZone),
    formatDateTime: (value: string) =>
      formatWebAdminDateTime(locale, value, timeZone),
  };
}

export type TenantI18n = {
  locale: ReturnType<typeof useWebAdminLocale>["locale"];
  timeZone: string;
  m: TenantMessages;
  formatDate: (value: string) => string;
  formatDateTime: (value: string) => string;
};
