import { getDb, type Database } from "@cleanhub/db";

import {
  assertActiveTenant,
  requireFeatureEnabled,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import {
  ensureTenantNotificationSettings,
  updateTenantNotificationSettingsRecord,
  writeTenantNotificationSettingsUpdatedAuditLog,
} from "./notifications.repository.js";
import type {
  GetTenantNotificationSettingsInput,
  TenantNotificationSettings,
  UpdateTenantNotificationSettingsInput,
} from "./notifications.types.js";

async function assertNotificationSettingsAccess(
  input: GetTenantNotificationSettingsInput,
  db: Database,
): Promise<void> {
  requireTenantRole(input.authContext, ["owner", "manager"]);
  await assertActiveTenant(input.authContext, db);
  await requireFeatureEnabled(input.authContext, "notifications", db);
}

export async function getTenantNotificationSettings(
  input: GetTenantNotificationSettingsInput,
  db: Database = getDb(),
): Promise<TenantNotificationSettings> {
  await assertNotificationSettingsAccess(input, db);

  return db.transaction((tx) =>
    ensureTenantNotificationSettings(tx, {
      actorUserId: input.authContext.userId,
      tenantId: input.authContext.tenantId!,
    }),
  );
}

export async function updateTenantNotificationSettings(
  input: UpdateTenantNotificationSettingsInput,
  db: Database = getDb(),
): Promise<TenantNotificationSettings> {
  await assertNotificationSettingsAccess(input, db);

  return db.transaction(async (tx) => {
    const tenantId = input.authContext.tenantId!;
    const before = await ensureTenantNotificationSettings(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
    });
    const after = await updateTenantNotificationSettingsRecord(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      data: input.data,
    });

    await writeTenantNotificationSettingsUpdatedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      before,
      after,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return after;
  });
}
