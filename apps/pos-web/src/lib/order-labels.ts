import type {
  PosOrderPaymentStatus,
  PosOrderSort,
  PosOrderStatus,
  PosOrderType,
  PosPaymentMethod,
  PosPaymentTransactionStatus,
} from "@cleanhub/api-client";
import {
  createTranslator,
  defaultLocale,
  hasMessage,
  type TranslationKey,
} from "@cleanhub/i18n";

import { getPosRuntimeLocale } from "@/components/i18n/pos-runtime-text";

/**
 * Order vocabulary, resolved per call rather than frozen at module load.
 *
 * These labels used to be module-scope `Record<Enum, string>` constants full
 * of Chinese. They reached the screen as `{ORDER_STATUS_LABELS[status]}` --
 * a JSX expression, not a literal text node -- so the app-wide auto
 * translation never saw them and a French cashier read Chinese order
 * statuses.
 *
 * Making the constants call the catalogue at module scope would not fix it:
 * a module body runs once, on first import, so the wording would freeze at
 * whatever locale the tab started in and a language switch would leave the
 * old text on screen. These are functions for that reason.
 *
 * Mirrors `ticket-labels.ts`, including its raw-value fallback.
 */
function label(key: TranslationKey, rawValue: string): string {
  const locale = getPosRuntimeLocale();
  if (!hasMessage(locale, key) && !hasMessage(defaultLocale, key)) {
    return rawValue;
  }
  return createTranslator({ locale })(key);
}

export const ORDER_STATUS_VALUES = [
  "draft",
  "received",
  "paid",
  "delivered",
  "cancelled",
] as const satisfies ReadonlyArray<PosOrderStatus>;

export const ORDER_PAYMENT_STATUS_VALUES = [
  "unpaid",
  "partial",
  "paid",
  "refunded",
] as const satisfies ReadonlyArray<PosOrderPaymentStatus>;

export const ORDER_TYPE_VALUES = [
  "ticket",
  "manual",
] as const satisfies ReadonlyArray<PosOrderType>;

export function getOrdersPageTitle(): string {
  return label("pos.order.title", "Orders");
}

/**
 * Takes a widened string, not just PosOrderStatus: some callers read the
 * status off a summary DTO that types it as plain string. An unknown value
 * falls back to the raw value rather than rendering a key path.
 */
export function getOrderStatusLabel(status: PosOrderStatus | string): string {
  return label(`pos.order.status.${status}` as TranslationKey, status);
}

/** Widened for the same reason as getOrderStatusLabel. */
export function getOrderPaymentStatusLabel(
  status: PosOrderPaymentStatus | string,
): string {
  return label(`pos.order.paymentStatus.${status}` as TranslationKey, status);
}

export function getOrderTypeLabel(type: PosOrderType): string {
  return label(`pos.order.type.${type}`, type);
}

export function getPaymentMethodLabel(method: PosPaymentMethod): string {
  return label(`pos.order.paymentMethod.${method}`, method);
}

export function getPaymentTransactionStatusLabel(
  status: PosPaymentTransactionStatus,
): string {
  return label(`pos.order.transactionStatus.${status}`, status);
}

export function getOrderSortLabel(sort: PosOrderSort): string {
  return label(`pos.order.sort.${sort}`, sort);
}

export function getOrderColumnLabel(column: string): string {
  return label(`pos.order.column.${column}` as TranslationKey, column);
}

export const ORDER_SORT_VALUES = [
  "created_desc",
  "created_asc",
  "amount_desc",
  "amount_asc",
] as const satisfies ReadonlyArray<PosOrderSort>;

export function getOrderPeriodLabel(period: string): string {
  return label(`pos.order.period.${period}` as TranslationKey, period);
}
