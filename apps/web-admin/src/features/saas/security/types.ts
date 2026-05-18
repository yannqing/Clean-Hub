export type SecurityEventSeverity = "low" | "medium" | "high" | "critical";

export type SecurityEventListQuery = {
  severity?: SecurityEventSeverity;
  eventType?: string;
  tenantId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};

export type SecurityEventListItem = {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  actorUserId: string | null;
  eventType: string;
  severity: SecurityEventSeverity;
  ipAddress: string | null;
  description: string | null;
  createdAt: string;
};

export type SecuritySettings = {
  id: string;
  settingKey: string;
  passwordMinLength: number;
  passwordRequiresNumber: boolean;
  passwordRequiresSymbol: boolean;
  loginMaxAttempts: number;
  lockoutMinutes: number;
  refreshTokenDays: number;
  updatedAt: string;
  updatedBy: string | null;
};

export type SecuritySettingsFormValues = {
  passwordMinLength: number;
  passwordRequiresNumber: boolean;
  passwordRequiresSymbol: boolean;
  loginMaxAttempts: number;
  lockoutMinutes: number;
  refreshTokenDays: number;
};

export type UpdateSecuritySettingsRequest = SecuritySettingsFormValues;

export type SecuritySettingsActionResult =
  | {
      ok: true;
      data: SecuritySettings;
    }
  | {
      ok: false;
      error: string;
    };
