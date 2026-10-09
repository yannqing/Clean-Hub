import { getDb, type Database } from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import { requireSaasRole, requireSuperAdmin } from "../../auth/permission.helper.js";
import {
  findPlatformSettings,
  upsertPlatformSettings,
} from "./platform-settings.repository.js";
import type {
  GetPlatformSettingsInput,
  PlatformSettings,
  PlatformSettingsAuditSnapshot,
  UpdatePlatformSettingsInput,
} from "./platform-settings.types.js";

const DEFAULT_PLATFORM_SETTINGS = {
  defaultLanguage: "en" as const,
  defaultCurrency: "XOF",
  timezone: "UTC",
  maintenanceMode: false,
};

function toAuditSnapshot(settings: PlatformSettings): PlatformSettingsAuditSnapshot {
  return {
    defaultLanguage: settings.defaultLanguage,
    defaultCurrency: settings.defaultCurrency,
    timezone: settings.timezone,
    maintenanceMode: settings.maintenanceMode,
  };
}

export async function getPlatformSettings(
  input: GetPlatformSettingsInput,
  db: Database = getDb(),
): Promise<PlatformSettings> {
  requireSaasRole(input.authContext, ["super_admin", "support"]);

  const settings = await findPlatformSettings(db);

  if (!settings) {
    return {
      id: null,
      ...DEFAULT_PLATFORM_SETTINGS,
      updatedAt: null,
      updatedBy: null,
      version: 0,
    };
  }

  return settings;
}

export async function updatePlatformSettings(
  input: UpdatePlatformSettingsInput,
  db: Database = getDb(),
): Promise<PlatformSettings> {
  requireSuperAdmin(input.authContext);

  return db.transaction(async (tx) => {
    const current = await findPlatformSettings(tx);
    const before = current ?? {
      id: null,
      ...DEFAULT_PLATFORM_SETTINGS,
      updatedAt: null,
      updatedBy: null,
      version: 0,
    };

    const merged = {
      defaultLanguage: input.data.defaultLanguage ?? before.defaultLanguage,
      defaultCurrency: input.data.defaultCurrency ?? before.defaultCurrency,
      timezone: input.data.timezone ?? before.timezone,
      maintenanceMode: input.data.maintenanceMode ?? before.maintenanceMode,
    };

    const updated = await upsertPlatformSettings(tx, {
      actorUserId: input.authContext.userId,
      ...merged,
    });

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: null,
      eventCategory: "saas_platform",
      eventType: "platform_settings.updated",
      entityType: "platform_settings",
      entityId: updated.id ?? undefined,
      before: toAuditSnapshot(before),
      after: toAuditSnapshot(updated),
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return updated;
  });
}
