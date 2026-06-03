import { getDb, type Database } from "@cleanhub/db";

import { writeAuditLog } from "../audit/audit.helper.js";
import { requireSaasRole, requireSuperAdmin } from "../auth/permission.helper.js";
import {
  DEFAULT_SECURITY_POLICY,
} from "./security-policy.js";
import {
  findSecuritySettings,
  upsertSecuritySettings,
} from "./security-settings.repository.js";
import type {
  GetSecuritySettingsInput,
  SecuritySettings,
  SecuritySettingsAuditSnapshot,
  UpdateSecuritySettingsInput,
} from "./security-settings.types.js";

const DEFAULT_SECURITY_SETTINGS = {
  settingKey: "default",
  ...DEFAULT_SECURITY_POLICY,
};

function toAuditSnapshot(
  settings: SecuritySettings,
): SecuritySettingsAuditSnapshot {
  return {
    passwordMinLength: settings.passwordMinLength,
    passwordRequiresNumber: settings.passwordRequiresNumber,
    passwordRequiresSymbol: settings.passwordRequiresSymbol,
    loginMaxAttempts: settings.loginMaxAttempts,
    lockoutMinutes: settings.lockoutMinutes,
    refreshTokenDays: settings.refreshTokenDays,
  };
}

function defaultSecuritySettings(): SecuritySettings {
  return {
    id: null,
    ...DEFAULT_SECURITY_SETTINGS,
    updatedAt: null,
    updatedBy: null,
    version: 0,
  };
}

export async function getSecuritySettings(
  input: GetSecuritySettingsInput,
  db: Database = getDb(),
): Promise<SecuritySettings> {
  requireSaasRole(input.authContext, ["super_admin", "support"]);

  return (await findSecuritySettings(db)) ?? defaultSecuritySettings();
}

export async function updateSecuritySettings(
  input: UpdateSecuritySettingsInput,
  db: Database = getDb(),
): Promise<SecuritySettings> {
  requireSuperAdmin(input.authContext);

  return db.transaction(async (tx) => {
    const current = await findSecuritySettings(tx);
    const before = current ?? defaultSecuritySettings();
    const merged = {
      passwordMinLength:
        input.data.passwordMinLength ?? before.passwordMinLength,
      passwordRequiresNumber:
        input.data.passwordRequiresNumber ?? before.passwordRequiresNumber,
      passwordRequiresSymbol:
        input.data.passwordRequiresSymbol ?? before.passwordRequiresSymbol,
      loginMaxAttempts: input.data.loginMaxAttempts ?? before.loginMaxAttempts,
      lockoutMinutes: input.data.lockoutMinutes ?? before.lockoutMinutes,
      refreshTokenDays: input.data.refreshTokenDays ?? before.refreshTokenDays,
    };
    const updated = await upsertSecuritySettings(tx, {
      actorUserId: input.authContext.userId,
      ...merged,
    });

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: null,
      eventCategory: "saas_security",
      eventType: "security_settings.updated",
      entityType: "security_settings",
      entityId: updated.id ?? undefined,
      before: toAuditSnapshot(before),
      after: toAuditSnapshot(updated),
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return updated;
  });
}
