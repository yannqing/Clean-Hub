import { and, eq, isNull, sql } from "drizzle-orm";

import {
  branches,
  type Database,
  tenantFeatureFlags,
  tenantSettings,
  tenants,
} from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
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

export type UpdateTenantProfileRecordInput = {
  tenantId: string;
  data: UpdateTenantSettingsRequest;
};

const DEFAULT_CURRENCY_FALLBACK = "XOF";

export async function findTenantDefaultLanguage(
  db: Database,
  tenantId: string,
): Promise<TenantSettingsLanguage> {
  const rows = await db
    .select({ defaultLanguage: tenantSettings.defaultLanguage })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  return resolveLanguage(rows[0]?.defaultLanguage);
}

export async function findTenantDefaultCurrency(
  db: Database,
  tenantId: string,
): Promise<string> {
  const rows = await db
    .select({ defaultCurrency: tenantSettings.defaultCurrency })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);
  const currency = rows[0]?.defaultCurrency.trim().toUpperCase();

  return currency && /^[A-Z]{3}$/.test(currency)
    ? currency
    : DEFAULT_CURRENCY_FALLBACK;
}

function resolveLanguage(
  value: string | null | undefined,
): TenantSettingsLanguage {
  if (value === "fr" || value === "zh-CN") {
    return value;
  }

  return "en";
}

function resolvePilotStatus(
  value: string | null | undefined,
): TenantPilotStatus {
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
      pressingCode: tenants.pressingCode,
      country: tenants.country,
      city: tenants.city,
      contactName: tenants.contactName,
      contactPhone: tenants.contactPhone,
      contactEmail: tenants.contactEmail,
      tenantUpdatedAt: tenants.updatedAt,
      tenantVersion: tenants.version,
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
    pressingCode: row.pressingCode,
    country: row.country,
    city: row.city,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    tenantUpdatedAt: row.tenantUpdatedAt.toISOString(),
    tenantVersion: row.tenantVersion,
    defaultLanguage: resolveLanguage(row.defaultLanguage),
    defaultCurrency: row.defaultCurrency ?? DEFAULT_CURRENCY_FALLBACK,
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

export async function updateTenantProfileRecord(
  db: Database,
  input: UpdateTenantProfileRecordInput,
): Promise<boolean> {
  const updates = {
    updatedAt: new Date(),
    version: sql`${tenants.version} + 1`,
    ...(input.data.tenantName !== undefined
      ? { name: input.data.tenantName }
      : {}),
    ...(input.data.country !== undefined
      ? { country: input.data.country }
      : {}),
    ...(input.data.city !== undefined ? { city: input.data.city } : {}),
    ...(input.data.contactName !== undefined
      ? { contactName: input.data.contactName }
      : {}),
    ...(input.data.contactPhone !== undefined
      ? { contactPhone: input.data.contactPhone }
      : {}),
    ...(input.data.contactEmail !== undefined
      ? { contactEmail: input.data.contactEmail }
      : {}),
  };

  const updatedRows = await db
    .update(tenants)
    .set(updates)
    .where(
      and(
        eq(tenants.id, input.tenantId),
        eq(tenants.version, input.data.tenantVersion!),
        isNull(tenants.deletedAt),
      ),
    )
    .returning({ id: tenants.id });

  return updatedRows.length === 1;
}

export async function updateTenantSettingsRecord(
  db: Database,
  input: UpdateTenantSettingsRecordInput,
): Promise<TenantSettings | null> {
  const hasSettingsUpdate =
    input.data.defaultLanguage !== undefined ||
    input.data.defaultCurrency !== undefined ||
    input.data.timezone !== undefined;

  if (!hasSettingsUpdate) {
    return findTenantSettingsByTenantId(db, input.tenantId);
  }

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

  if (defaultCurrency !== input.currentSettings.defaultCurrency) {
    await db
      .update(branches)
      .set({
        defaultCurrency,
        updatedAt: new Date(),
        updatedBy: input.actorUserId,
        version: sql`${branches.version} + 1`,
      })
      .where(
        and(eq(branches.tenantId, input.tenantId), isNull(branches.deletedAt)),
      );
  }

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
      tenantName: input.before.tenantName,
      country: input.before.country,
      city: input.before.city,
      contactName: input.before.contactName,
      contactPhone: input.before.contactPhone,
      contactEmail: input.before.contactEmail,
      tenantVersion: input.before.tenantVersion,
      defaultLanguage: input.before.defaultLanguage,
      defaultCurrency: input.before.defaultCurrency,
      timezone: input.before.timezone,
    },
    after: {
      tenantName: input.after.tenantName,
      country: input.after.country,
      city: input.after.city,
      contactName: input.after.contactName,
      contactPhone: input.after.contactPhone,
      contactEmail: input.after.contactEmail,
      tenantVersion: input.after.tenantVersion,
      defaultLanguage: input.after.defaultLanguage,
      defaultCurrency: input.after.defaultCurrency,
      timezone: input.after.timezone,
    },
  });
}
