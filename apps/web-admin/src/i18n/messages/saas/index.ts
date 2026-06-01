import type { WebAdminLocale } from "../../locale";
import { saasMessagesEn } from "./en";
import type { SaasMessages } from "./types";
import { saasMessagesZhCN } from "./zh-CN";

export type { SaasMessages };

export const saasMessagesByLocale: Record<WebAdminLocale, SaasMessages> = {
  en: saasMessagesEn,
  "zh-CN": saasMessagesZhCN,
};

export function interpolate(
  template: string,
  values: Record<string, string>,
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}
