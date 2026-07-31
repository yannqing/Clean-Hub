import type {
  PosOrderPaymentStatus,
  PosOrderSort,
  PosOrderStatus,
  PosOrderType,
  PosMobileMoneyProvider,
  PosPaymentMethod,
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

export const ORDER_STATUS_LABELS: Record<PosOrderStatus, string> = {
  draft: "草稿",
  received: "待支付",
  paid: "已付款",
  delivered: "已交付",
  cancelled: "已取消",
};

export const ORDER_STATUS_TONES: Record<PosOrderStatus, BadgeTone> = {
  draft: "slate",
  received: "blue",
  paid: "emerald",
  delivered: "violet",
  cancelled: "red",
};

export const ORDER_PAYMENT_STATUS_LABELS: Record<
  PosOrderPaymentStatus,
  string
> = {
  unpaid: "未支付",
  partial: "部分支付",
  paid: "已结清",
  refunded: "已退款",
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

export const ORDER_TYPE_LABELS: Record<PosOrderType, string> = {
  ticket: "工单订单",
  manual: "普通订单",
};

export const PAYMENT_METHOD_LABELS: Record<PosPaymentMethod, string> = {
  cash: "现金",
  card: "银行卡",
  app: "移动支付",
};

export const MOBILE_MONEY_PROVIDER_LABELS: Record<
  PosMobileMoneyProvider,
  string
> = {
  wave: "Wave",
  orange_money: "Orange Money",
};

export const PAYMENT_TRANSACTION_STATUS_LABELS: Record<
  PosPaymentTransactionStatus,
  string
> = {
  pending: "待确认",
  paid: "已支付",
  refunded: "已退款",
  failed: "失败",
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

export const ORDER_STATUS_OPTIONS = (
  Object.keys(ORDER_STATUS_LABELS) as PosOrderStatus[]
).map((value) => ({ value, label: ORDER_STATUS_LABELS[value] }));

export const ORDER_PAYMENT_STATUS_OPTIONS = (
  Object.keys(ORDER_PAYMENT_STATUS_LABELS) as PosOrderPaymentStatus[]
).map((value) => ({ value, label: ORDER_PAYMENT_STATUS_LABELS[value] }));

export const ORDER_TYPE_OPTIONS = (
  Object.keys(ORDER_TYPE_LABELS) as PosOrderType[]
).map((value) => ({ value, label: ORDER_TYPE_LABELS[value] }));

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

export const ORDER_SORT_OPTIONS: ReadonlyArray<{
  value: PosOrderSort;
  label: string;
}> = [
  { value: "created_desc", label: "创建时间：从新到旧" },
  { value: "created_asc", label: "创建时间：从旧到新" },
  { value: "amount_desc", label: "订单金额：从高到低" },
  { value: "amount_asc", label: "订单金额：从低到高" },
];

export const ORDER_COLUMN_KEYS = [
  "order",
  "customer",
  "amount",
  "status",
  "payment",
  "createdAt",
] as const;

export type OrderColumnKey = (typeof ORDER_COLUMN_KEYS)[number];

export const ORDER_COLUMN_LABELS: Record<OrderColumnKey, string> = {
  order: "订单",
  customer: "客户",
  amount: "金额",
  status: "订单状态",
  payment: "支付状态",
  createdAt: "创建时间",
};

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
  return date.toLocaleString(locale, options);
}

export function displayOrderCode(orderId: string): string {
  return formatPosOrderCode(orderId);
}
