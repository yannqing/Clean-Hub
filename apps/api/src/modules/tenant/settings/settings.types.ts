import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

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
  pressingCode: string;
  country: string | null;
  city: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  tenantUpdatedAt: string;
  tenantVersion: number;
  defaultLanguage: TenantSettingsLanguage;
  defaultCurrency: string;
  timezone: string;
  pilotStatus: TenantPilotStatus;
  updatedAt: string | null;
  updatedBy: string | null;
  version: number;
  featureFlags: TenantSettingsFeatureFlags;
};

export type UpdateTenantSettingsRequest = {
  tenantName?: string;
  country?: string | null;
  city?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  tenantVersion?: number;
  defaultLanguage?: TenantSettingsLanguage;
  defaultCurrency?: string;
  timezone?: string;
};

export type GetTenantSettingsInput = {
  authContext: AuthContext;
};

export type UpdateTenantSettingsInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: UpdateTenantSettingsRequest;
};
