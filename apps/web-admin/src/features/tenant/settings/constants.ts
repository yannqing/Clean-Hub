import type { TenantSettingsLanguage } from "./types";

export const tenantSettingsLanguageOptions = [
  { label: "English", value: "en" },
  { label: "French", value: "fr" },
  { label: "Chinese", value: "zh-CN" },
] as const satisfies Array<{
  label: string;
  value: TenantSettingsLanguage;
}>;

const preferredTenantSettingsTimezoneOptions = [
  "UTC",
  "Africa/Abidjan",
  "Africa/Dakar",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Africa/Casablanca",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Calcutta",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

const preferredTenantSettingsTimezoneSet = new Set<string>(
  preferredTenantSettingsTimezoneOptions,
);

export const tenantSettingsTimezoneOptions = [
  ...preferredTenantSettingsTimezoneOptions,
  ...Intl.supportedValuesOf("timeZone")
    .filter(
      (timezone) => !preferredTenantSettingsTimezoneSet.has(timezone),
    )
    .sort((left, right) => left.localeCompare(right)),
];

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
