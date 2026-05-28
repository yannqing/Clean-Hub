import type { TenantSettingsLanguage } from "./types";

export const tenantSettingsLanguageOptions = [
  { label: "English", value: "en" },
  { label: "French", value: "fr" },
  { label: "Chinese", value: "zh-CN" },
] as const satisfies Array<{
  label: string;
  value: TenantSettingsLanguage;
}>;

export const tenantPilotStatusLabels = {
  pilot: "Pilot",
  live: "Live",
  paused: "Paused",
} as const;

export const tenantSettingsFeatureFlagOptions = [
  {
    key: "laundryEnabled",
    label: "Laundry and dry cleaning",
  },
  {
    key: "carWashEnabled",
    label: "Car wash",
  },
  {
    key: "retailProductsEnabled",
    label: "Retail products",
  },
  {
    key: "deliveryEnabled",
    label: "Pickup and delivery",
  },
  {
    key: "notificationsEnabled",
    label: "Notifications",
  },
] as const;
