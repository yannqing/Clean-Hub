/**
 * 客户管理 — UI constants (labels, status maps, defaults).
 */
import type {
  CustomerStatusFilter,
  CustomerFilterState,
  ProfileFormValues,
  ResultTypeFilter,
} from "./types";

export const CUSTOMERS_PAGE_TITLE = "客户管理";
export const CUSTOMERS_PAGE_DESCRIPTION =
  "一次查询同时匹配客户账户和客户档案，店员无需提前判断手机号属于哪种数据。";

export const CUSTOMER_DEFAULT_FILTERS: CustomerFilterState = {
  query: "",
  resultType: "all",
  status: "all",
  page: 1,
  pageSize: 10,
};

export const CUSTOMER_RESULT_TYPE_OPTIONS: {
  value: ResultTypeFilter;
  label: string;
}[] = [
  { value: "all", label: "全部结果类型" },
  { value: "account", label: "仅客户账户" },
  { value: "profile", label: "仅客户档案" },
];

export const CUSTOMER_STATUS_OPTIONS: {
  value: CustomerStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "正常" },
  { value: "disabled", label: "停用" },
];

export const CUSTOMER_COLUMN_KEYS = [
  "customer",
  "contact",
  "account",
  "status",
  "createdAt",
  "actions",
] as const;

export type CustomerColumnKey = (typeof CUSTOMER_COLUMN_KEYS)[number];

export const CUSTOMER_COLUMN_LABELS: Record<CustomerColumnKey, string> = {
  customer: "客户",
  contact: "联系方式",
  account: "所属账户",
  status: "状态",
  createdAt: "创建时间",
  actions: "操作",
};

/** Status -> display label + badge classes. */
export const CUSTOMER_STATUS_META = {
  active: {
    label: "正常",
    badgeClassName: "bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-500",
  },
  disabled: {
    label: "停用",
    badgeClassName: "bg-muted text-muted-foreground",
    dotClassName: "bg-muted-foreground",
  },
} as const;

export const CUSTOMER_LIST_VIEW_TITLE = "客户管理";
export const CUSTOMER_LIST_VIEW_SUBTITLE =
  "一次查询同时匹配客户账户和客户档案，店员无需提前判断手机号属于哪种数据。";

export const CUSTOMER_PROFILE_RELATIONSHIPS = ["本人", "家庭成员", "企业员工"];

export const EMPTY_ACCOUNT_FORM = {
  accountName: "",
  phone: "",
  email: "",
};

export const EMPTY_PROFILE_FORM: ProfileFormValues = {
  customerAccountId: "",
  fullName: "",
  phone: "",
  email: "",
  relationship: "本人",
  address: "",
  notes: "",
};

/** Placeholder for stats the milestone doc defers (tier/balance/orders). */
export const CUSTOMER_STAT_PLACEHOLDER = "—";

// ---- 服务工单 label maps (local, not cross-feature imports) ----------------
// Values mirror apps/pos-web/src/features/tickets/constants.ts but are kept
// local so the customers feature does not depend on the tickets feature.

export const CUSTOMER_TICKET_STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  pending: "待处理",
  in_progress: "处理中",
  ready_to_pick: "待取件",
  picked_up: "已取件",
  cancelled: "已取消",
  exception: "异常",
};

export const CUSTOMER_TICKET_STATUS_TONES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-accent text-accent-foreground",
  in_progress: "bg-accent text-accent-foreground",
  ready_to_pick: "bg-secondary text-secondary-foreground",
  picked_up: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
  exception: "bg-amber-50 text-amber-700",
};

export const CUSTOMER_TICKET_TYPE_LABELS: Record<string, string> = {
  laundry: "洗衣护理",
  car_wash: "车辆清洗",
  retail: "零售",
  delivery: "配送",
};

export const CUSTOMER_TICKET_PRIORITY_LABELS: Record<string, string> = {
  normal: "普通",
  urgent: "加急",
  critical: "最紧急",
};

// ---- 订单 label maps (local) -----------------------------------------------

export const CUSTOMER_ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  received: "已接收",
  paid: "已支付",
  delivered: "已交付",
  cancelled: "已取消",
};

export const CUSTOMER_ORDER_STATUS_TONES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  received: "bg-accent text-accent-foreground",
  paid: "bg-emerald-50 text-emerald-700",
  delivered: "bg-secondary text-secondary-foreground",
  cancelled: "bg-red-50 text-red-700",
};

export const CUSTOMER_ORDER_PAYMENT_LABELS: Record<string, string> = {
  unpaid: "未支付",
  paid: "已支付",
  partial: "部分支付",
  refunded: "已退款",
};

export const CUSTOMER_ORDER_PAYMENT_TONES: Record<string, string> = {
  unpaid: "bg-red-50 text-red-700",
  paid: "bg-emerald-50 text-emerald-700",
  partial: "bg-amber-50 text-amber-700",
  refunded: "bg-muted text-muted-foreground",
};

export const CUSTOMER_ORDER_TYPE_LABELS: Record<string, string> = {
  ticket: "工单订单",
  manual: "手动订单",
};

// ---- 工单项目（服务项目）label maps (local) ---------------------------------
// Powers the 服务项目 tab on the customer detail view.

export const CUSTOMER_TICKET_ITEM_STATUS_LABELS: Record<string, string> = {
  pending_wash: "待清洗",
  washing: "清洗中",
  done: "已完成",
  ready_to_pick: "待取件",
  exception: "异常",
};

export const CUSTOMER_TICKET_ITEM_STATUS_TONES: Record<string, string> = {
  pending_wash: "bg-muted text-muted-foreground",
  washing: "bg-accent text-accent-foreground",
  done: "bg-emerald-50 text-emerald-700",
  ready_to_pick: "bg-secondary text-secondary-foreground",
  exception: "bg-red-50 text-red-700",
};

export const CUSTOMER_TICKET_ITEM_TYPE_LABELS: Record<string, string> = {
  cloth: "衣物",
  car: "车",
  shoe: "鞋",
  carpet: "地毯",
};
