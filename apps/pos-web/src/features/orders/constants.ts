import type {
  PosOrderPaymentStatus,
  PosOrderStatus,
  PosMobileMoneyProvider,
  PosPaymentTransactionStatus,
} from "@cleanhub/api-client";
import { formatPosOrderCode } from "@cleanhub/domain/order-codes";

import { getPosRuntimeLocale } from "@/components/i18n/pos-runtime-text";
import { DEFAULT_POS_CURRENCY, formatPosMoney } from "@/lib/money";

export const ORDERS_PAGE_TITLE = "订单管理";
export const DEFAULT_ORDER_PAGE_SIZE = 10;
export const DEFAULT_ORDER_CURRENCY = DEFAULT_POS_CURRENCY;
export const ORDER_EMPTY_PLACEHOLDER = "—";

export type BadgeTone =
  | "slate"
  | "blue"
  | "violet"
  | "emerald"
  | "amber"
  | "red";

export const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  slate: "bg-muted text-muted-foreground",
  blue: "bg-accent text-accent-foreground",
  violet: "bg-secondary text-secondary-foreground",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
};


export const ORDER_STATUS_TONES: Record<PosOrderStatus, BadgeTone> = {
  draft: "slate",
  received: "blue",
  paid: "emerald",
  delivered: "violet",
  cancelled: "red",
};


export const ORDER_PAYMENT_STATUS_TONES: Record<
  PosOrderPaymentStatus,
  BadgeTone
> = {
  unpaid: "slate",
  partial: "amber",
  paid: "emerald",
  refunded: "violet",
};



export const MOBILE_MONEY_PROVIDER_LABELS: Record<
  PosMobileMoneyProvider,
  string
> = {
  wave: "Wave",
  orange_money: "Orange Money",
};


export const PAYMENT_TRANSACTION_STATUS_TONES: Record<
  PosPaymentTransactionStatus,
  string
> = {
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
  refunded: "bg-secondary text-secondary-foreground",
  failed: "bg-red-50 text-red-700",
};

export const ORDER_FILTER_KEYS = {
  q: "q",
  status: "status",
  paymentStatus: "paymentStatus",
  orderType: "orderType",
  date: "date",
  sort: "sort",
  columns: "columns",
  page: "page",
  pageSize: "pageSize",
} as const;

export type OrderDateFilter = "all" | "today" | "last_7d" | "month";


export const ORDER_COLUMN_KEYS = [
  "order",
  "customer",
  "amount",
  "status",
  "payment",
  "createdAt",
] as const;

export type OrderColumnKey = (typeof ORDER_COLUMN_KEYS)[number];


export function formatOrderMoney(
  amount: string | number | null | undefined,
  currency = DEFAULT_ORDER_CURRENCY,
  locale = getPosRuntimeLocale(),
): string {
  return formatPosMoney(amount, currency, locale);
}

export function formatOrderDateTime(
  iso: string | null | undefined,
  locale = "zh-CN",
  timeZone = "UTC",
  options: Intl.DateTimeFormatOptions = {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  if (!iso) {
    return ORDER_EMPTY_PLACEHOLDER;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return ORDER_EMPTY_PLACEHOLDER;
  }
  return date.toLocaleString(locale, { ...options, timeZone });
}

export function displayOrderCode(orderId: string): string {
  return formatPosOrderCode(orderId);
}
