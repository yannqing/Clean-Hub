import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

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

export type PlatformSettingsAuditSnapshot = {
  defaultLanguage: string;
  defaultCurrency: string;
  timezone: string;
  maintenanceMode: boolean;
};

export type UpdatePlatformSettingsRequest = {
  defaultLanguage?: PlatformSettingsLanguage;
  defaultCurrency?: string;
  timezone?: string;
  maintenanceMode?: boolean;
};

export type GetPlatformSettingsInput = {
  authContext: AuthContext;
};

export type UpdatePlatformSettingsInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: UpdatePlatformSettingsRequest;
};
