import { createId } from "@cleanhub/id";
import { eq, sql } from "drizzle-orm";

import { platformSettings, type Database } from "@cleanhub/db";

import type {
  PlatformSettings,
  PlatformSettingsLanguage,
} from "./platform-settings.types.js";

function resolvePlatformLanguage(
  value: string | null | undefined,
): PlatformSettingsLanguage {
  if (value === "fr" || value === "zh-CN") {
    return value;
  }

  return "en";
}

function toPlatformSettings(row: {
  id: string;
  defaultLanguage: string;
  defaultCurrency: string;
  timezone: string;
  maintenanceMode: boolean;
  updatedAt: Date;
  updatedBy: string | null;
  version: number;
}): PlatformSettings {
  return {
    id: row.id,
    defaultLanguage: resolvePlatformLanguage(row.defaultLanguage),
    defaultCurrency: row.defaultCurrency,
    timezone: row.timezone,
    maintenanceMode: row.maintenanceMode,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
    version: row.version,
  };
}

export async function findPlatformSettings(
  db: Database,
): Promise<PlatformSettings | null> {
  const rows = await db
    .select({
      id: platformSettings.id,
      defaultLanguage: platformSettings.defaultLanguage,
      defaultCurrency: platformSettings.defaultCurrency,
      timezone: platformSettings.timezone,
      maintenanceMode: platformSettings.maintenanceMode,
      updatedAt: platformSettings.updatedAt,
      updatedBy: platformSettings.updatedBy,
      version: platformSettings.version,
    })
    .from(platformSettings)
    .where(eq(platformSettings.settingKey, "default"))
    .limit(1);

  const row = rows[0];

  return row ? toPlatformSettings(row) : null;
}

export type UpsertPlatformSettingsInput = {
  actorUserId: string;
  defaultLanguage: PlatformSettingsLanguage;
  defaultCurrency: string;
  timezone: string;
  maintenanceMode: boolean;
};

export async function upsertPlatformSettings(
  db: Database,
  input: UpsertPlatformSettingsInput,
): Promise<PlatformSettings> {
  await db
    .insert(platformSettings)
    .values({
      id: createId(),
      settingKey: "default",
      defaultLanguage: input.defaultLanguage,
      defaultCurrency: input.defaultCurrency,
      timezone: input.timezone,
      maintenanceMode: input.maintenanceMode,
      updatedBy: input.actorUserId,
    })
    .onConflictDoUpdate({
      target: platformSettings.settingKey,
      set: {
        defaultLanguage: input.defaultLanguage,
        defaultCurrency: input.defaultCurrency,
        timezone: input.timezone,
        maintenanceMode: input.maintenanceMode,
        updatedAt: new Date(),
        updatedBy: input.actorUserId,
        version: sql`${platformSettings.version} + 1`,
      },
    });

  const updated = await findPlatformSettings(db);

  return updated!;
}
