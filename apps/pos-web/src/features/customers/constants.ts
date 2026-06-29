/**
 * 客户管理 — UI constants (labels, status maps, defaults).
 */
import type {
  CustomerFilterState,
  ProfileFormValues,
  ResultTypeFilter,
} from "./types";

export const CUSTOMERS_PAGE_TITLE = "客户管理";
export const CUSTOMERS_PAGE_DESCRIPTION =
  "一次查询同时匹配客户账户和客户档案，店员无需提前判断手机号属于哪种数据。";

/** Default page size options for the pagination control. */
export const CUSTOMER_PAGE_SIZE_OPTIONS = [5, 10] as const;

export const CUSTOMER_DEFAULT_FILTERS: CustomerFilterState = {
  query: "",
  resultType: "all",
  page: 1,
  pageSize: 5,
};

export const CUSTOMER_RESULT_TYPE_OPTIONS: {
  value: ResultTypeFilter;
  label: string;
}[] = [
  { value: "all", label: "全部结果类型" },
  { value: "account", label: "仅客户账户" },
  { value: "profile", label: "仅客户档案" },
];

/** Status -> display label + badge classes. */
export const CUSTOMER_STATUS_META = {
  active: {
    label: "正常",
    badgeClassName: "bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-500",
  },
  disabled: {
    label: "停用",
    badgeClassName: "bg-slate-100 text-slate-500",
    dotClassName: "bg-slate-400",
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
