export type PlatformSettingsLanguage = "en" | "fr" | "zh-CN";

export type PlatformSettings = {
  id: string | null;
  defaultLanguage: PlatformSettingsLanguage;
  defaultCurrency: string;
  timezone: string;
  maintenanceMode: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  version: number;
};

export type UpdatePlatformSettingsRequest = {
  defaultLanguage?: PlatformSettingsLanguage;
  defaultCurrency?: string;
  timezone?: string;
  maintenanceMode?: boolean;
};
