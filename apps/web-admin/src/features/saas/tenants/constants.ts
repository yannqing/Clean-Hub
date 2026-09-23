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
  country: "Senegal",
  defaultCurrency: "XOF",
  defaultLanguage: "platform-default",
  initialOwnerDisplayName: "",
  initialOwnerEmail: "",
  initialOwnerPassword: "",
  initialOwnerPhone: "",
  initialOwnerPin: "",
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
  {
    key: "emailEnabled",
    label: "Email sending",
    description:
      "Emailed receipts and notifications. Needs platform SMTP; without it the option stays hidden at the till even when this is on.",
  },
  {
    key: "customerOtpEnabled",
    label: "Customer one-time-code login",
    description:
      "Allows customer OTP sign-in. Keep this off until an SMS or email delivery provider is configured.",
  },
] as const;
