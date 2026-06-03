import type { BranchFormValues, BranchLanguage } from "./types";

export const branchLanguageOptions: {
  label: string;
  value: BranchLanguage;
}[] = [
  { label: "English", value: "en" },
  { label: "French", value: "fr" },
  { label: "Chinese", value: "zh-CN" },
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
