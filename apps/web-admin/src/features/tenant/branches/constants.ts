import type {
  BranchBusinessHoursFormValues,
  BranchFormValues,
  BranchLanguage,
  BranchWeekday,
} from "./types";

/**
 * 支持的门店默认语言。label 由组件通过 i18n（messages.tenant.common.languageLabels）注入，
 * 这里只保留 value，避免硬编码英文。
 */
export const branchLanguageValues: BranchLanguage[] = ["en", "fr", "zh-CN"];

/**
 * 兼容旧调用方的 { label, value } 形式。
 * 注意：label 仍为硬编码英文，仅供未接入 i18n 的废弃组件（branch-list-view）使用，
 * 新代码请用 branchLanguageValues + messages.tenant.common.languageLabels。
 */
export const branchLanguageOptions: { label: string; value: BranchLanguage }[] =
  [
    { label: "English", value: "en" },
    { label: "French", value: "fr" },
    { label: "Chinese", value: "zh-CN" },
  ];

export const branchWeekdays: BranchWeekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export function createEmptyBranchBusinessHours(): BranchBusinessHoursFormValues {
  return Object.fromEntries(
    branchWeekdays.map((weekday) => [
      weekday,
      { enabled: false, opensAt: "09:00", closesAt: "18:00" },
    ]),
  ) as BranchBusinessHoursFormValues;
}

export const emptyBranchFormValues: BranchFormValues = {
  name: "",
  address: "",
  phone: "",
  defaultLanguage: "en",
  defaultCurrency: "",
  receiptName: "",
  receiptPhone: "",
  receiptAddress: "",
  logoObjectKey: "",
  removeLogo: false,
  businessHours: createEmptyBranchBusinessHours(),
  status: "active",
};
