export type {
  PlatformSettings,
  PlatformSettingsLanguage,
  UpdatePlatformSettingsRequest,
} from "@cleanhub/api-client";

export type PlatformSettingsFormValues = {
  defaultLanguage: "en" | "fr" | "zh-CN";
  defaultCurrency: string;
  timezone: string;
  maintenanceMode: boolean;
};
