import type {
  TenantBackOfficeSettings,
  TenantPilotStatus,
  TenantSettingsFeatureFlags,
  TenantSettingsLanguage,
  UpdateTenantBackOfficeSettingsRequest,
} from "@cleanhub/api-client";

export type {
  TenantPilotStatus,
  TenantSettingsFeatureFlags,
  TenantSettingsLanguage,
};

export type TenantSettings = TenantBackOfficeSettings;
export type UpdateTenantSettingsRequest = UpdateTenantBackOfficeSettingsRequest;

export type TenantSettingsFormValues = {
  defaultLanguage: TenantSettingsLanguage;
  timezone: string;
};

export type TenantProfileFormValues = {
  tenantName: string;
  country: string;
  city: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  tenantVersion: number;
};
