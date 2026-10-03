import { getDb, type Database } from "@cleanhub/db";

import {
  assertActiveTenant,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { TenantSettingsError } from "./settings.errors.js";
import {
  findTenantSettingsByTenantId,
  updateTenantProfileRecord,
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

function hasTenantProfileUpdate(data: UpdateTenantSettingsInput["data"]): boolean {
  return [
    data.tenantName,
    data.country,
    data.city,
    data.contactName,
    data.contactPhone,
    data.contactEmail,
  ].some((value) => value !== undefined);
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

    if (input.data.country !== undefined && input.data.country !== before.country) {
      throw new TenantSettingsError(
        "TENANT_COUNTRY_SAAS_MANAGED",
        "Country changes must be made by a SaaS administrator so the tax template and currency stay in sync.",
        422,
      );
    }
    if (input.data.defaultCurrency !== undefined &&
        input.data.defaultCurrency !== before.defaultCurrency) {
      throw new TenantSettingsError(
        "TENANT_CURRENCY_SAAS_MANAGED",
        "Currency changes must be made by a SaaS administrator together with the country tax template.",
        422,
      );
    }

    if (hasTenantProfileUpdate(input.data)) {
      const updated = await updateTenantProfileRecord(tx, {
        tenantId,
        data: input.data,
      });

      if (!updated) {
        throw new TenantSettingsError(
          "TENANT_PROFILE_VERSION_CONFLICT",
          "Tenant details changed in another session. Reload and try again.",
          409,
        );
      }
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
