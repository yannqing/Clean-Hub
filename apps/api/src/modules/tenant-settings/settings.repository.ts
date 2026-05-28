import { and, eq, isNull, sql } from "drizzle-orm";

import {
  type Database,
  tenantFeatureFlags,
  tenantSettings,
  tenants,
} from "@cleanhub/db";

import { writeAuditLog } from "../audit/audit.helper.js";
import type {
  TenantPilotStatus,
  TenantSettings,
  TenantSettingsLanguage,
  UpdateTenantSettingsRequest,
} from "./settings.types.js";

export type UpdateTenantSettingsRecordInput = {
  tenantId: string;
  actorUserId: string;
  data: UpdateTenantSettingsRequest;
  currentSettings: TenantSettings;
};

function resolveLanguage(value: string | null | undefined): TenantSettingsLanguage {
  if (value === "fr" || value === "zh-CN") {
    return value;
  }

  return "en";
}

function resolvePilotStatus(value: string | null | undefined): TenantPilotStatus {
  if (value === "live" || value === "paused") {
    return value;
  }

  return "pilot";
}

export async function findTenantSettingsByTenantId(
  db: Database,
  tenantId: string,
): Promise<TenantSettings | null> {
  const rows = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      settingsId: tenantSettings.id,
      defaultLanguage: tenantSettings.defaultLanguage,
      defaultCurrency: tenantSettings.defaultCurrency,
      timezone: tenantSettings.timezone,
      pilotStatus: tenantSettings.pilotStatus,
      settingsUpdatedAt: tenantSettings.updatedAt,
      settingsUpdatedBy: tenantSettings.updatedBy,
      settingsVersion: tenantSettings.version,
      featureFlagsId: tenantFeatureFlags.id,
      laundryEnabled: tenantFeatureFlags.laundryEnabled,
      carWashEnabled: tenantFeatureFlags.carWashEnabled,
      retailProductsEnabled: tenantFeatureFlags.retailProductsEnabled,
      deliveryEnabled: tenantFeatureFlags.deliveryEnabled,
      notificationsEnabled: tenantFeatureFlags.notificationsEnabled,
      featureFlagsUpdatedAt: tenantFeatureFlags.updatedAt,
      featureFlagsUpdatedBy: tenantFeatureFlags.updatedBy,
      featureFlagsVersion: tenantFeatureFlags.version,
    })
    .from(tenants)
    .innerJoin(tenantSettings, eq(tenantSettings.tenantId, tenants.id))
    .innerJoin(tenantFeatureFlags, eq(tenantFeatureFlags.tenantId, tenants.id))
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.settingsId,
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    defaultLanguage: resolveLanguage(row.defaultLanguage),
    defaultCurrency: row.defaultCurrency ?? "XOF",
    timezone: row.timezone ?? "UTC",
    pilotStatus: resolvePilotStatus(row.pilotStatus),
    updatedAt: row.settingsUpdatedAt?.toISOString() ?? null,
    updatedBy: row.settingsUpdatedBy,
    version: row.settingsVersion ?? 0,
    featureFlags: {
      id: row.featureFlagsId,
      tenantId: row.tenantId,
      laundryEnabled: row.laundryEnabled,
      carWashEnabled: row.carWashEnabled,
      retailProductsEnabled: row.retailProductsEnabled,
      deliveryEnabled: row.deliveryEnabled,
      notificationsEnabled: row.notificationsEnabled,
      updatedAt: row.featureFlagsUpdatedAt?.toISOString() ?? null,
      updatedBy: row.featureFlagsUpdatedBy,
      version: row.featureFlagsVersion ?? 0,
    },
  };
}

export async function updateTenantSettingsRecord(
  db: Database,
  input: UpdateTenantSettingsRecordInput,
): Promise<TenantSettings | null> {
  const defaultLanguage =
    input.data.defaultLanguage ?? input.currentSettings.defaultLanguage;
  const defaultCurrency =
    input.data.defaultCurrency ?? input.currentSettings.defaultCurrency;
  const timezone = input.data.timezone ?? input.currentSettings.timezone;

  await db
    .update(tenantSettings)
    .set({
      defaultLanguage,
      defaultCurrency,
      timezone,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${tenantSettings.version} + 1`,
    })
    .where(eq(tenantSettings.tenantId, input.tenantId));

  return findTenantSettingsByTenantId(db, input.tenantId);
}

export async function writeTenantSettingsUpdatedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    before: TenantSettings;
    after: TenantSettings;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.after.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "tenant_settings",
    eventType: "settings.updated",
    entityType: "tenant_settings",
    entityId: input.after.id ?? input.after.tenantId,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    before: {
      defaultLanguage: input.before.defaultLanguage,
      defaultCurrency: input.before.defaultCurrency,
      timezone: input.before.timezone,
    },
    after: {
      defaultLanguage: input.after.defaultLanguage,
      defaultCurrency: input.after.defaultCurrency,
      timezone: input.after.timezone,
    },
  });
}
