import type { BranchFormValues, BranchLanguage } from "./types";

export const branchLanguageOptions: {
  label: string;
  value: BranchLanguage;
}[] = [
  { label: "English", value: "en" },
  { label: "Français", value: "fr" },
  { label: "简体中文", value: "zh-CN" },
];

export const emptyBranchFormValues: BranchFormValues = {
  name: "",
  address: "",
  phone: "",
  defaultLanguage: "en",
  defaultCurrency: "XOF",
  receiptName: "",
  receiptPhone: "",
  receiptAddress: "",
  logoUrl: "",
  businessHoursJson: "",
  status: "active",
};
