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

export type UpdateSecuritySettingsRequest = {
  passwordMinLength?: number;
  passwordRequiresNumber?: boolean;
  passwordRequiresSymbol?: boolean;
  loginMaxAttempts?: number;
  lockoutMinutes?: number;
  refreshTokenDays?: number;
};
