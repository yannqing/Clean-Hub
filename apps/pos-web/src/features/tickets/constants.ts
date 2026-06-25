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

// --- 工单项目：颜色 / 品牌 / 材质预设选项 -----------------------------------

/** 常见颜色选项（洗衣/干洗场景），按色系分组。 */
export const ITEM_COLOR_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  // 基础色
  { value: "白色", label: "白色" },
  { value: "黑色", label: "黑色" },
  { value: "灰色", label: "灰色" },
  { value: "米色", label: "米色" },
  // 彩色
  { value: "红色", label: "红色" },
  { value: "蓝色", label: "蓝色" },
  { value: "绿色", label: "绿色" },
  { value: "黄色", label: "黄色" },
  { value: "紫色", label: "紫色" },
  { value: "粉色", label: "粉色" },
  { value: "橙色", label: "橙色" },
  { value: "棕色", label: "棕色" },
  // 深色系
  { value: "藏青", label: "藏青" },
  { value: "深灰", label: "深灰" },
  { value: "深蓝", label: "深蓝" },
  { value: "深绿", label: "深绿" },
  { value: "酒红", label: "酒红" },
  { value: "驼色", label: "驼色" },
  // 浅色系
  { value: "浅蓝", label: "浅蓝" },
  { value: "浅粉", label: "浅粉" },
  { value: "浅灰", label: "浅灰" },
  { value: "奶白", label: "奶白" },
  { value: "杏色", label: "杏色" },
  // 花色
  { value: "花色", label: "花色" },
  { value: "格子", label: "格子" },
  { value: "条纹", label: "条纹" },
  { value: "迷彩", label: "迷彩" },
];

/** 常见品牌选项（覆盖国际/国内主流服装品牌）。 */
export const ITEM_BRAND_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  // 国际快时尚
  { value: "ZARA", label: "ZARA" },
  { value: "H&M", label: "H&M" },
  { value: "UNIQLO", label: "UNIQLO（优衣库）" },
  { value: "GAP", label: "GAP" },
  { value: "Mango", label: "Mango" },
  { value: "COS", label: "COS" },
  // 国际运动
  { value: "Nike", label: "Nike（耐克）" },
  { value: "Adidas", label: "Adidas（阿迪达斯）" },
  { value: "Puma", label: "Puma（彪马）" },
  { value: "New Balance", label: "New Balance" },
  { value: "Under Armour", label: "Under Armour" },
  // 国际奢侈
  { value: "Gucci", label: "Gucci" },
  { value: "Louis Vuitton", label: "Louis Vuitton（LV）" },
  { value: "Chanel", label: "Chanel（香奈儿）" },
  { value: "Prada", label: "Prada" },
  { value: "Burberry", label: "Burberry（博柏利）" },
  { value: "Hermès", label: "Hermès（爱马仕）" },
  { value: "Dior", label: "Dior（迪奥）" },
  { value: "Armani", label: "Armani（阿玛尼）" },
  { value: "Ralph Lauren", label: "Ralph Lauren（拉夫劳伦）" },
  // 国内男装
  { value: "雅戈尔", label: "雅戈尔" },
  { value: "七匹狼", label: "七匹狼" },
  { value: "海澜之家", label: "海澜之家" },
  { value: "利郎", label: "利郎" },
  { value: "柒牌", label: "柒牌" },
  { value: "九牧王", label: "九牧王" },
  // 国内女装
  { value: "太平鸟", label: "太平鸟" },
  { value: "拉夏贝尔", label: "拉夏贝尔" },
  { value: "歌力思", label: "歌力思" },
  { value: "地素", label: "地素" },
  { value: "伊芙丽", label: "伊芙丽" },
  { value: "VERO MODA", label: "VERO MODA" },
  // 国内运动
  { value: "李宁", label: "李宁" },
  { value: "安踏", label: "安踏" },
  { value: "特步", label: "特步" },
  { value: "361°", label: "361°" },
  { value: "匹克", label: "匹克" },
  // 国内休闲
  { value: "森马", label: "森马" },
  { value: "美特斯邦威", label: "美特斯邦威" },
  { value: "以纯", label: "以纯" },
  { value: "GXG", label: "GXG" },
  { value: "JACK & JONES", label: "JACK & JONES" },
];

/** 常见材质选项（覆盖天然/化学/混纺纤维）。 */
export const ITEM_MATERIAL_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  // 天然纤维
  { value: "棉", label: "棉" },
  { value: "麻", label: "麻" },
  { value: "丝绸", label: "丝绸" },
  { value: "羊毛", label: "羊毛" },
  { value: "羊绒", label: "羊绒" },
  { value: "驼绒", label: "驼绒" },
  { value: "亚麻", label: "亚麻" },
  // 化学纤维
  { value: "聚酯纤维", label: "聚酯纤维（涤纶）" },
  { value: "尼龙", label: "尼龙（锦纶）" },
  { value: "腈纶", label: "腈纶" },
  { value: "氨纶", label: "氨纶（弹性纤维）" },
  { value: "人造丝", label: "人造丝（粘胶）" },
  { value: "天丝", label: "天丝（莱赛尔）" },
  // 混纺
  { value: "棉混纺", label: "棉混纺" },
  { value: "毛混纺", label: "毛混纺" },
  { value: "丝混纺", label: "丝混纺" },
  { value: "涤棉混纺", label: "涤棉混纺" },
  // 其他
  { value: "皮革", label: "皮革" },
  { value: "麂皮", label: "麂皮" },
  { value: "羽绒", label: "羽绒" },
  { value: "针织", label: "针织" },
  { value: "牛仔", label: "牛仔" },
  { value: "蕾丝", label: "蕾丝" },
  { value: "雪纺", label: "雪纺" },
];

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
