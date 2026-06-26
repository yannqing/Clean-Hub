import type {
  PosOrderPaymentStatus,
  PosOrderStatus,
  PosOrderType,
  PosPaymentMethod,
} from "@cleanhub/api-client";

export const ORDERS_PAGE_TITLE = "订单管理";
export const DEFAULT_ORDER_PAGE_SIZE = 20;
export const DEFAULT_ORDER_CURRENCY = "XOF";
export const ORDER_EMPTY_PLACEHOLDER = "—";

export type BadgeTone = "slate" | "blue" | "violet" | "emerald" | "amber" | "red";

export const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-blue-50 text-blue-700",
  violet: "bg-violet-50 text-violet-700",
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
  app: "App",
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
  page: "page",
  pageSize: "pageSize",
} as const;

export type OrderDateFilter = "all" | "today" | "last_7d" | "month";

export function formatOrderMoney(
  amount: string | number | null | undefined,
  currency = DEFAULT_ORDER_CURRENCY,
): string {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) {
    return `${currency} 0`;
  }
  return `${currency} ${value.toLocaleString("en-US")}`;
}

export function formatOrderDateTime(
  iso: string | null | undefined,
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
  return date.toLocaleString("zh-CN", options);
}

export function displayOrderCode(orderId: string): string {
  return `OD-${orderId.slice(-8).toUpperCase()}`;
}
