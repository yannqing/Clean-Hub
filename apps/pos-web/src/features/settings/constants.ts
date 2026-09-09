/**
 * 设置 — UI constants (labels, options, defaults).
 */

export const SETTINGS_PAGE_TITLE = "设置";
export const SETTINGS_PAGE_DESCRIPTION = "配置终端设备、收银偏好和门店信息。";

// ---- 支付方式选项 ----

export const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "现金" },
  { value: "card", label: "刷卡" },
  { value: "app", label: "移动支付" },
] as const;

// ---- 抹零规则选项 ----

export const ROUNDING_RULE_OPTIONS = [
  { value: "none", label: "不抹零" },
  { value: "round_yuan", label: "抹到元" },
  { value: "round_jiao", label: "抹到角" },
] as const;

// ---- 表单默认值 ----

export const TERMINAL_SETTINGS_DEFAULTS = {
  label: "",
  defaultPaymentMethod: "cash" as const,
  paymentMethodsEnabled: ["cash", "app"] as ("cash" | "card" | "app")[],
  cashHandlingMode: "shared_drawer" as const,
  roundingRule: "none" as const,
  autoPrintReceipt: true,
  printCopies: 1,
  lockTimeoutSeconds: 300,
};

// ---- 锁屏超时选项 ----

export const LOCK_TIMEOUT_OPTIONS = [
  { value: 60, label: "1 分钟" },
  { value: 120, label: "2 分钟" },
  { value: 300, label: "5 分钟" },
  { value: 600, label: "10 分钟" },
  { value: 1800, label: "30 分钟" },
  { value: 3600, label: "1 小时" },
] as const;

// ---- 打印联数选项 ----

export const PRINT_COPIES_OPTIONS = [
  { value: 1, label: "1 联" },
  { value: 2, label: "2 联" },
  { value: 3, label: "3 联" },
] as const;
