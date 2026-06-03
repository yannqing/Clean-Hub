import { getDb, type Database } from "@cleanhub/db";

import { findSecuritySettings } from "./security-settings.repository.js";

export const DEFAULT_SECURITY_POLICY = {
  passwordMinLength: 8,
  passwordRequiresNumber: true,
  passwordRequiresSymbol: false,
  loginMaxAttempts: 5,
  lockoutMinutes: 15,
  refreshTokenDays: 30,
} as const;

export type EffectiveSecurityPolicy = {
  passwordMinLength: number;
  passwordRequiresNumber: boolean;
  passwordRequiresSymbol: boolean;
  loginMaxAttempts: number;
  lockoutMinutes: number;
  refreshTokenDays: number;
};

export async function resolveEffectiveSecurityPolicy(
  db: Database = getDb(),
): Promise<EffectiveSecurityPolicy> {
  const settings = await findSecuritySettings(db);

  if (!settings) {
    return { ...DEFAULT_SECURITY_POLICY };
  }

  return {
    passwordMinLength: settings.passwordMinLength,
    passwordRequiresNumber: settings.passwordRequiresNumber,
    passwordRequiresSymbol: settings.passwordRequiresSymbol,
    loginMaxAttempts: settings.loginMaxAttempts,
    lockoutMinutes: settings.lockoutMinutes,
    refreshTokenDays: settings.refreshTokenDays,
  };
}

export function getRefreshTokenTtlSeconds(policy: EffectiveSecurityPolicy): number {
  return policy.refreshTokenDays * 24 * 60 * 60;
}
