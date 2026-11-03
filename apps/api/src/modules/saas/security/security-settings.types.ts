import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type SecuritySettings = {
  id: string | null;
  settingKey: string;
  passwordMinLength: number;
  passwordRequiresNumber: boolean;
  passwordRequiresSymbol: boolean;
  loginMaxAttempts: number;
  lockoutMinutes: number;
  refreshTokenDays: number;
  updatedAt: string | null;
  updatedBy: string | null;
  version: number;
};

export type SecuritySettingsAuditSnapshot = {
  passwordMinLength: number;
  passwordRequiresNumber: boolean;
  passwordRequiresSymbol: boolean;
  loginMaxAttempts: number;
  lockoutMinutes: number;
  refreshTokenDays: number;
};

export type UpdateSecuritySettingsRequest = Partial<SecuritySettingsAuditSnapshot>;

export type GetSecuritySettingsInput = {
  authContext: AuthContext;
};

export type UpdateSecuritySettingsInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: UpdateSecuritySettingsRequest;
};
