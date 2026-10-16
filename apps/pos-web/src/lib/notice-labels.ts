import type {
  PosNoticePriority,
  PosNoticeReadStatus,
  PosNoticeRelatedType,
  PosNoticeType,
} from "@cleanhub/api-client";
import {
  createTranslator,
  defaultLocale,
  hasMessage,
  type TranslationKey,
} from "@cleanhub/i18n";

import { getPosRuntimeLocale } from "@/components/i18n/pos-runtime-text";

/**
 * Notification vocabulary. Same shape and the same reasons as
 * `order-labels.ts`: functions rather than constants, so the wording follows
 * a language switch instead of freezing at the locale the tab started in.
 */
function label(key: TranslationKey, rawValue: string): string {
  const locale = getPosRuntimeLocale();
  if (!hasMessage(locale, key) && !hasMessage(defaultLocale, key)) {
    return rawValue;
  }
  return createTranslator({ locale })(key);
}

export function getNoticeTypeLabel(type: PosNoticeType): string {
  return label(`pos.notice.type.${type}`, type);
}

export function getNoticeReadStatusLabel(status: PosNoticeReadStatus): string {
  return label(`pos.notice.readStatus.${status}`, status);
}

export function getNoticePriorityLabel(priority: PosNoticePriority): string {
  return label(`pos.notice.priority.${priority}`, priority);
}

export function getNoticeRelatedTypeLabel(
  relatedType: PosNoticeRelatedType,
): string {
  return label(`pos.notice.relatedType.${relatedType}`, relatedType);
}

export function getNotificationsPageTitle(): string {
  return label("pos.notice.title", "Notifications");
}

/**
 * Filter options, built per call so the labels follow the language.
 *
 * The declaration order is deliberate and not the enum order: priority reads
 * critical first, because that is the one a cashier filters for.
 */
export function getNoticeTypeOptions(): ReadonlyArray<{
  value: PosNoticeType;
  label: string;
}> {
  return (["business", "system"] as const).map((value) => ({
    value,
    label: getNoticeTypeLabel(value),
  }));
}

export function getNoticeReadStatusOptions(): ReadonlyArray<{
  value: PosNoticeReadStatus;
  label: string;
}> {
  return (["unread", "read", "archived"] as const).map((value) => ({
    value,
    label: getNoticeReadStatusLabel(value),
  }));
}

export function getNoticePriorityOptions(): ReadonlyArray<{
  value: PosNoticePriority;
  label: string;
}> {
  return (["critical", "high", "normal", "low"] as const).map((value) => ({
    value,
    label: getNoticePriorityLabel(value),
  }));
}

export function getNoticeRelatedTypeOptions(): ReadonlyArray<{
  value: PosNoticeRelatedType;
  label: string;
}> {
  return (["order", "ticket"] as const).map((value) => ({
    value,
    label: getNoticeRelatedTypeLabel(value),
  }));
}
