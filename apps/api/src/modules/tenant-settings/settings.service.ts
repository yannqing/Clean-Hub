import { getDb, type Database } from "@cleanhub/db";

import {
  assertActiveTenant,
  requireTenantRole,
} from "../auth/permission.helper.js";
import { TenantSettingsError } from "./settings.errors.js";
import {
  findTenantSettingsByTenantId,
  updateTenantSettingsRecord,
  writeTenantSettingsUpdatedAuditLog,
} from "./settings.repository.js";
import type {
  GetTenantSettingsInput,
  TenantSettings,
  UpdateTenantSettingsInput,
} from "./settings.types.js";

function hasUpdateField(data: object): boolean {
  return Object.values(data).some((value) => value !== undefined);
}

export async function getTenantSettings(
  input: GetTenantSettingsInput,
  db: Database = getDb(),
): Promise<TenantSettings> {
  requireTenantRole(input.authContext, ["owner", "manager"]);
  await assertActiveTenant(input.authContext, db);

  const settings = await findTenantSettingsByTenantId(
    db,
    input.authContext.tenantId!,
  );

  if (!settings) {
    throw new TenantSettingsError(
      "TENANT_SETTINGS_NOT_FOUND",
      "Tenant settings or feature flags were not found.",
      404,
    );
  }

  return settings;
}

export async function updateTenantSettings(
  input: UpdateTenantSettingsInput,
  db: Database = getDb(),
): Promise<TenantSettings> {
  requireTenantRole(input.authContext, ["owner"]);
  await assertActiveTenant(input.authContext, db);

  if (!hasUpdateField(input.data)) {
    throw new TenantSettingsError(
      "TENANT_SETTINGS_UPDATE_EMPTY",
      "At least one tenant setting must be provided.",
      422,
    );
  }

  return db.transaction(async (tx) => {
    const tenantId = input.authContext.tenantId!;
    const before = await findTenantSettingsByTenantId(tx, tenantId);

    if (!before) {
      throw new TenantSettingsError(
        "TENANT_SETTINGS_NOT_FOUND",
        "Tenant settings or feature flags were not found.",
        404,
      );
    }

    const settings = await updateTenantSettingsRecord(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      data: input.data,
      currentSettings: before,
    });

    if (!settings) {
      throw new TenantSettingsError(
        "TENANT_SETTINGS_NOT_FOUND",
        "Tenant settings or feature flags were not found.",
        404,
      );
    }

    await writeTenantSettingsUpdatedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      before,
      after: settings,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return settings;
  });
}
