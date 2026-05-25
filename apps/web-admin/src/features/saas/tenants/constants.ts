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
  country: "Senegal",
  defaultCurrency: "XOF",
  defaultLanguage: "platform-default",
  name: "",
  pressingCode: "",
} as const;

export const tenantFeatureFlagOptions = [
  {
    key: "laundryEnabled",
    label: "Laundry and dry cleaning",
    description: "Core laundry, pressing, and dry cleaning workflows.",
  },
  {
    key: "carWashEnabled",
    label: "Car wash",
    description: "Car wash services, pricing, and operations entry points.",
  },
  {
    key: "retailProductsEnabled",
    label: "Retail products",
    description: "Laundry liquid, care products, consumables, and retail sales.",
  },
  {
    key: "deliveryEnabled",
    label: "Pickup and delivery",
    description: "Doorstep pickup, delivery states, and delivery staff flows.",
  },
  {
    key: "notificationsEnabled",
    label: "Notifications",
    description: "WhatsApp, SMS, email settings, and send records.",
  },
] as const;
