import { createId } from "@cleanhub/id";
import { eq, sql } from "drizzle-orm";

import { securitySettings, type Database } from "@cleanhub/db";

import type {
  SecuritySettings,
  SecuritySettingsAuditSnapshot,
} from "./security-settings.types.js";

function toSecuritySettings(row: {
  id: string;
  settingKey: string;
  passwordMinLength: number;
  passwordRequiresNumber: boolean;
  passwordRequiresSymbol: boolean;
  loginMaxAttempts: number;
  lockoutMinutes: number;
  refreshTokenDays: number;
  updatedAt: Date;
  updatedBy: string | null;
  version: number;
}): SecuritySettings {
  return {
    id: row.id,
    settingKey: row.settingKey,
    passwordMinLength: row.passwordMinLength,
    passwordRequiresNumber: row.passwordRequiresNumber,
    passwordRequiresSymbol: row.passwordRequiresSymbol,
    loginMaxAttempts: row.loginMaxAttempts,
    lockoutMinutes: row.lockoutMinutes,
    refreshTokenDays: row.refreshTokenDays,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
    version: row.version,
  };
}

export async function findSecuritySettings(
  db: Database,
): Promise<SecuritySettings | null> {
  const rows = await db
    .select({
      id: securitySettings.id,
      settingKey: securitySettings.settingKey,
      passwordMinLength: securitySettings.passwordMinLength,
      passwordRequiresNumber: securitySettings.passwordRequiresNumber,
      passwordRequiresSymbol: securitySettings.passwordRequiresSymbol,
      loginMaxAttempts: securitySettings.loginMaxAttempts,
      lockoutMinutes: securitySettings.lockoutMinutes,
      refreshTokenDays: securitySettings.refreshTokenDays,
      updatedAt: securitySettings.updatedAt,
      updatedBy: securitySettings.updatedBy,
      version: securitySettings.version,
    })
    .from(securitySettings)
    .where(eq(securitySettings.settingKey, "default"))
    .limit(1);

  const row = rows[0];

  return row ? toSecuritySettings(row) : null;
}

export type UpsertSecuritySettingsInput = SecuritySettingsAuditSnapshot & {
  actorUserId: string;
};

export async function upsertSecuritySettings(
  db: Database,
  input: UpsertSecuritySettingsInput,
): Promise<SecuritySettings> {
  await db
    .insert(securitySettings)
    .values({
      id: createId(),
      settingKey: "default",
      passwordMinLength: input.passwordMinLength,
      passwordRequiresNumber: input.passwordRequiresNumber,
      passwordRequiresSymbol: input.passwordRequiresSymbol,
      loginMaxAttempts: input.loginMaxAttempts,
      lockoutMinutes: input.lockoutMinutes,
      refreshTokenDays: input.refreshTokenDays,
      updatedBy: input.actorUserId,
    })
    .onConflictDoUpdate({
      target: securitySettings.settingKey,
      set: {
        passwordMinLength: input.passwordMinLength,
        passwordRequiresNumber: input.passwordRequiresNumber,
        passwordRequiresSymbol: input.passwordRequiresSymbol,
        loginMaxAttempts: input.loginMaxAttempts,
        lockoutMinutes: input.lockoutMinutes,
        refreshTokenDays: input.refreshTokenDays,
        updatedAt: new Date(),
        updatedBy: input.actorUserId,
        version: sql`${securitySettings.version} + 1`,
      },
    });

  const updated = await findSecuritySettings(db);

  return updated!;
}
