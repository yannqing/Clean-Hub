import type { SecuritySettings } from "@cleanhub/api-client";

export type {
  SecurityEventListItem,
  SecurityEventListQuery,
  SecurityEventSeverity,
  SecuritySettings,
  UpdateSecuritySettingsRequest,
} from "@cleanhub/api-client";

export type SecuritySettingsFormValues = {
  passwordMinLength: number;
  passwordRequiresNumber: boolean;
  passwordRequiresSymbol: boolean;
  loginMaxAttempts: number;
  lockoutMinutes: number;
  refreshTokenDays: number;
};

export type SecuritySettingsActionResult =
  | {
      ok: true;
      data: SecuritySettings;
    }
  | {
      ok: false;
      error: string;
    };
