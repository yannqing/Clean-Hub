/**
 * 工单管理 — UI constants.
 *
 * All label/tone maps are keyed by the wire enums from
 * `@cleanhub/api-client` so the API client stays the single source of truth
 * for the values. The maps themselves are UI-only (display + coloring).
 */

import type {
  ServiceTicketItemStatus,
  ServiceTicketItemType,
  ServiceTicketPriority,
  ServiceTicketSourceChannel,
  ServiceTicketStatus,
  ServiceTicketType,
} from "@cleanhub/api-client";

export const TICKETS_PAGE_TITLE = "工单管理";

/** Tailwind tone token → concrete bg/text classes. Keeps badge components tiny. */
export type BadgeTone =
  | "slate"
  | "blue"
  | "violet"
  | "emerald"
  | "amber"
  | "red";

export const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-blue-50 text-blue-700",
  violet: "bg-violet-50 text-violet-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
};

// --- 工单状态 -------------------------------------------------------------

export const TICKET_STATUS_LABELS: Record<ServiceTicketStatus, string> = {
  draft: "草稿",
  pending: "待处理",
  in_progress: "处理中",
  ready_to_pick: "待取件",
  picked_up: "已取件",
  cancelled: "已取消",
  exception: "异常",
};

export const TICKET_STATUS_TONES: Record<ServiceTicketStatus, BadgeTone> = {
  draft: "slate",
  pending: "blue",
  in_progress: "blue",
  ready_to_pick: "violet",
  picked_up: "emerald",
  cancelled: "red",
  exception: "amber",
};

/** Terminal (no further transitions) states. */
export const TICKET_TERMINAL_STATUSES: ReadonlySet<ServiceTicketStatus> =
  new Set<ServiceTicketStatus>(["picked_up", "cancelled"]);

/**
 * Allowed next statuses from a given status. Mirrors the backend
 * `service-tickets.state-machine.ts` so the UI can pre-filter invalid
 * transitions client-side; the backend still rejects illegal moves.
 */
export const TICKET_STATUS_TRANSITIONS: Record<
  ServiceTicketStatus,
  ServiceTicketStatus[]
> = {
  draft: ["pending", "cancelled"],
  pending: ["in_progress", "cancelled"],
  in_progress: ["ready_to_pick", "exception"],
  ready_to_pick: ["picked_up", "exception"],
  exception: ["in_progress", "cancelled"],
  picked_up: [],
  cancelled: [],
};

// --- 工单优先级 -----------------------------------------------------------

export const TICKET_PRIORITY_LABELS: Record<ServiceTicketPriority, string> = {
  normal: "普通",
  urgent: "加急",
  critical: "最紧急",
};

export const TICKET_PRIORITY_TONES: Record<ServiceTicketPriority, BadgeTone> = {
  normal: "slate",
  urgent: "amber",
  critical: "red",
};

// --- 来源渠道 -------------------------------------------------------------

export const TICKET_SOURCE_LABELS: Record<
  ServiceTicketSourceChannel,
  string
> = {
  pos: "POS",
  app: "App",
  phone: "电话",
  whatsapp: "WhatsApp",
};

export const TICKET_SOURCE_TONES: Record<
  ServiceTicketSourceChannel,
  BadgeTone
> = {
  pos: "slate",
  app: "blue",
  phone: "violet",
  whatsapp: "emerald",
};

// --- 工单类型（业务线）----------------------------------------------------

export const TICKET_TYPE_LABELS: Record<ServiceTicketType, string> = {
  laundry: "洗衣护理",
  car_wash: "车辆清洗",
  retail: "零售",
  delivery: "配送",
};

// --- 工单项目 -------------------------------------------------------------

export const TICKET_ITEM_TYPE_LABELS: Record<ServiceTicketItemType, string> = {
  cloth: "衣物",
  car: "车",
  shoe: "鞋",
  carpet: "地毯",
};

export const TICKET_ITEM_STATUS_LABELS: Record<
  ServiceTicketItemStatus,
  string
> = {
  washing: "清洗中",
  done: "已完成",
  ready_to_pick: "待取件",
};

export const TICKET_ITEM_STATUS_TONES: Record<
  ServiceTicketItemStatus,
  BadgeTone
> = {
  washing: "blue",
  done: "emerald",
  ready_to_pick: "violet",
};

export const TICKET_ITEM_STATUS_TRANSITIONS: Record<
  ServiceTicketItemStatus,
  ServiceTicketItemStatus[]
> = {
  washing: ["done"],
  done: ["ready_to_pick", "washing"],
  ready_to_pick: [],
};

// --- 选项列表（供 select / 筛选条复用） -----------------------------------

export const TICKET_STATUS_OPTIONS: ReadonlyArray<{
  value: ServiceTicketStatus;
  label: string;
}> = (
  Object.keys(TICKET_STATUS_LABELS) as ServiceTicketStatus[]
).map((value) => ({ value, label: TICKET_STATUS_LABELS[value] }));

export const TICKET_PRIORITY_OPTIONS: ReadonlyArray<{
  value: ServiceTicketPriority;
  label: string;
}> = (
  Object.keys(TICKET_PRIORITY_LABELS) as ServiceTicketPriority[]
).map((value) => ({ value, label: TICKET_PRIORITY_LABELS[value] }));

export const TICKET_TYPE_OPTIONS: ReadonlyArray<{ value: ServiceTicketType; label: string }> = (
  Object.keys(TICKET_TYPE_LABELS) as ServiceTicketType[]
).map((value) => ({ value, label: TICKET_TYPE_LABELS[value] }));

export const TICKET_SOURCE_OPTIONS: ReadonlyArray<{
  value: ServiceTicketSourceChannel;
  label: string;
}> = (
  Object.keys(TICKET_SOURCE_LABELS) as ServiceTicketSourceChannel[]
).map((value) => ({ value, label: TICKET_SOURCE_LABELS[value] }));

export const TICKET_ITEM_TYPE_OPTIONS: ReadonlyArray<{
  value: ServiceTicketItemType;
  label: string;
}> = (
  Object.keys(TICKET_ITEM_TYPE_LABELS) as ServiceTicketItemType[]
).map((value) => ({ value, label: TICKET_ITEM_TYPE_LABELS[value] }));

// --- 格式化 --------------------------------------------------------------

/** Default currency shown when the active branch does not expose one. */
export const DEFAULT_TICKET_CURRENCY = "XOF";

/**
 * Format a wire money string (`"45.00"`) into a compact display string.
 * The wire value is a string to preserve precision; we parse to a number
 * only at the display boundary.
 */
export function formatTicketMoney(
  amount: string | number | null | undefined,
  currency = DEFAULT_TICKET_CURRENCY,
): string {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) {
    return `${currency} 0`;
  }
  return `${currency} ${value.toLocaleString("en-US")}`;
}

/**
 * Format an ISO timestamp into a short local date-time. Returns the em dash
 * placeholder for null/empty so the UI never prints the literal "null".
 */
export function formatTicketDateTime(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString("zh-CN", options);
}

export const TICKET_EMPTY_PLACEHOLDER = "—";
