import type { WebAdminLocale } from "../../locale";
import { tenantMessagesEn } from "./en";
import type { TenantMessages } from "./types";
import { tenantMessagesZhCN } from "./zh-CN";

export type { TenantMessages };

export const tenantMessagesByLocale: Record<WebAdminLocale, TenantMessages> = {
  en: tenantMessagesEn,
  "zh-CN": tenantMessagesZhCN,
};

/**
 * 插值模板，例如 "Only showing the first {limit} branches..." → {limit: "100"}。
 * 与 saas/index.ts 的 interpolate 保持一致。
 */
export function interpolate(
  template: string,
  values: Record<string, string>,
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}
