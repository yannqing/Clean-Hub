import type {
  SecuritySettingsFormValues,
  UpdateSecuritySettingsRequest,
} from "../types";

type ValidationResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: string;
    };

function normalizeInteger(value: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : Number.NaN;
}

export function validateSecuritySettings(
  input: SecuritySettingsFormValues,
): ValidationResult<UpdateSecuritySettingsRequest> {
  const passwordMinLength = normalizeInteger(input.passwordMinLength);
  const loginMaxAttempts = normalizeInteger(input.loginMaxAttempts);
  const lockoutMinutes = normalizeInteger(input.lockoutMinutes);
  const refreshTokenDays = normalizeInteger(input.refreshTokenDays);

  if (Number.isNaN(passwordMinLength) || passwordMinLength < 6) {
    return {
      ok: false,
      error: "Password minimum length must be at least 6.",
    };
  }

  if (passwordMinLength > 128) {
    return {
      ok: false,
      error: "Password minimum length must be 128 or fewer.",
    };
  }

  if (Number.isNaN(loginMaxAttempts) || loginMaxAttempts < 1) {
    return {
      ok: false,
      error: "Login max attempts must be at least 1.",
    };
  }

  if (loginMaxAttempts > 20) {
    return {
      ok: false,
      error: "Login max attempts must be 20 or fewer.",
    };
  }

  if (Number.isNaN(lockoutMinutes) || lockoutMinutes < 1) {
    return {
      ok: false,
      error: "Lockout minutes must be at least 1.",
    };
  }

  if (lockoutMinutes > 1440) {
    return {
      ok: false,
      error: "Lockout minutes must be 1440 or fewer.",
    };
  }

  if (Number.isNaN(refreshTokenDays) || refreshTokenDays < 1) {
    return {
      ok: false,
      error: "Refresh token days must be at least 1.",
    };
  }

  if (refreshTokenDays > 365) {
    return {
      ok: false,
      error: "Refresh token days must be 365 or fewer.",
    };
  }

  return {
    ok: true,
    data: {
      passwordMinLength,
      passwordRequiresNumber: input.passwordRequiresNumber,
      passwordRequiresSymbol: input.passwordRequiresSymbol,
      loginMaxAttempts,
      lockoutMinutes,
      refreshTokenDays,
    },
  };
}
