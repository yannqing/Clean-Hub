/** Large scrollable dialog shell for tenant detail/settings on the list page. */
export const tenantDialogContentClass =
  "flex max-h-[min(92vh,960px)] w-full max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl";

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

export const tenantCreateLanguageOptions = [
  { label: "Use platform default", value: "platform-default" },
  ...tenantLanguageOptions,
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
  country: "",
  defaultCurrency: "",
  defaultLanguage: "platform-default",
  featureFlags: {
    laundryEnabled: true,
    carWashEnabled: false,
    retailProductsEnabled: false,
    deliveryEnabled: false,
    notificationsEnabled: true,
    emailEnabled: false,
    customerOtpEnabled: false,
  },
  initialOwnerDisplayName: "",
  initialOwnerEmail: "",
  initialOwnerPhone: "",
  name: "",
  pressingCode: "",
} as const;

export const tenantFeatureFlagOptions = [
  { key: "laundryEnabled" },
  { key: "carWashEnabled" },
  { key: "retailProductsEnabled" },
  { key: "deliveryEnabled" },
  { key: "notificationsEnabled" },
  { key: "emailEnabled" },
  { key: "customerOtpEnabled" },
] as const;
