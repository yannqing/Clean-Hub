export const tenantStatusLabels = {
  active: "Active",
  suspended: "Suspended",
  disabled: "Disabled",
} as const;

export const tenantLanguageOptions = [
  { label: "English", value: "en" },
  { label: "French", value: "fr" },
  { label: "Chinese", value: "zh-CN" },
] as const;

export const tenantStatusOptions = [
  { label: tenantStatusLabels.active, value: "active" },
  { label: tenantStatusLabels.suspended, value: "suspended" },
  { label: tenantStatusLabels.disabled, value: "disabled" },
] as const;

export const tenantDefaultValues = {
  city: "",
  contactEmail: "",
  contactName: "",
  contactPhone: "",
  country: "Senegal",
  defaultCurrency: "XOF",
  defaultLanguage: "en",
  name: "",
  pressingCode: "",
} as const;
