export type TenantSettingsLanguage = "en" | "fr" | "zh-CN";
export type TenantPilotStatus = "pilot" | "live" | "paused";

export type TenantSettingsFeatureFlags = {
  id: string | null;
  tenantId: string;
  laundryEnabled: boolean;
  carWashEnabled: boolean;
  retailProductsEnabled: boolean;
  deliveryEnabled: boolean;
  notificationsEnabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  version: number;
};

export type TenantSettings = {
  id: string | null;
  tenantId: string;
  tenantName: string;
  defaultLanguage: TenantSettingsLanguage;
  defaultCurrency: string;
  timezone: string;
  pilotStatus: TenantPilotStatus;
  updatedAt: string | null;
  updatedBy: string | null;
  version: number;
  featureFlags: TenantSettingsFeatureFlags;
};

export type TenantSettingsFormValues = {
  defaultLanguage: TenantSettingsLanguage;
  defaultCurrency: string;
  timezone: string;
};

export type UpdateTenantSettingsRequest = {
  defaultLanguage?: TenantSettingsLanguage;
  defaultCurrency?: string;
  timezone?: string;
};
