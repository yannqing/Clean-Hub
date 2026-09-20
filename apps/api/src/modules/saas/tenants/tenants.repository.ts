import { createId } from "@cleanhub/id";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  type Database,
  authRefreshTokens,
  branches,
  getDb,
  platformSettings,
  roles,
  tenantFeatureFlags,
  tenantSettings,
  tenants,
  userProfiles,
  userRoles,
  users,
} from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import type {
  CreateSaasTenantRequest,
  ListSaasTenantsQuery,
  SaasTenantAuditSnapshot,
  SaasTenantDetail,
  SaasTenantFeatureFlags,
  SaasTenantLanguage,
  SaasTenantListResult,
  SaasTenantListItem,
  SaasTenantSettings,
  SaasTenantStatus,
  UpdateSaasTenantFeatureFlagsRequest,
  UpdateSaasTenantSettingsRequest,
  UpdateSaasTenantRequest,
} from "./tenants.types.js";

export type TenantPressingCodeRecord = {
  id: string;
};

export type CreateSaasTenantRecordInput = CreateSaasTenantRequest & {
  actorUserId: string;
  pressingCode: string;
  defaultLanguage: SaasTenantLanguage;
};

export type UpdateSaasTenantRecordInput = {
  actorUserId: string;
  tenantId: string;
  data: UpdateSaasTenantRequest & {
    pressingCode?: string;
  };
};

export type UpdateSaasTenantStatusRecordInput = {
  tenantId: string;
  status: SaasTenantStatus;
};

export type UpdateSaasTenantSettingsRecordInput = {
  actorUserId: string;
  tenantId: string;
  data: UpdateSaasTenantSettingsRequest;
  currentSettings: SaasTenantSettings;
};

export type UpdateSaasTenantFeatureFlagsRecordInput = {
  actorUserId: string;
  tenantId: string;
  data: UpdateSaasTenantFeatureFlagsRequest;
  currentFeatureFlags: SaasTenantFeatureFlags;
};

function normalizeSearchQuery(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? `%${trimmed}%` : undefined;
}

function resolveTenantLanguage(
  value: string | null | undefined,
): SaasTenantLanguage {
  if (value === "fr" || value === "zh-CN") {
    return value;
  }

  return "en";
}

function toTenantSummary(row: {
  id: string;
  name: string;
  pressingCode: string;
  status: string;
  country: string | null;
  city: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SaasTenantListItem {
  return {
    id: row.id,
    name: row.name,
    pressingCode: row.pressingCode,
    status: row.status as SaasTenantStatus,
    country: row.country,
    city: row.city,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function createEmptyStatusCounts(): Record<SaasTenantStatus, number> {
  return {
    active: 0,
    suspended: 0,
    disabled: 0,
  };
}

function toTenantSettings(row: {
  settingsId: string | null;
  tenantId: string;
  defaultLanguage: string | null;
  defaultCurrency: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  version: number | null;
}): SaasTenantSettings {
  return {
    id: row.settingsId,
    tenantId: row.tenantId,
    defaultLanguage: resolveTenantLanguage(row.defaultLanguage),
    defaultCurrency: row.defaultCurrency ?? "XOF",
    updatedAt: row.updatedAt?.toISOString() ?? null,
    updatedBy: row.updatedBy,
    version: row.version ?? 0,
  };
}

function toTenantFeatureFlags(row: {
  featureFlagsId: string | null;
  tenantId: string;
  laundryEnabled: boolean | null;
  carWashEnabled: boolean | null;
  retailProductsEnabled: boolean | null;
  deliveryEnabled: boolean | null;
  notificationsEnabled: boolean | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  version: number | null;
}): SaasTenantFeatureFlags {
  return {
    id: row.featureFlagsId,
    tenantId: row.tenantId,
    laundryEnabled: row.laundryEnabled ?? true,
    carWashEnabled: row.carWashEnabled ?? false,
    retailProductsEnabled: row.retailProductsEnabled ?? false,
    deliveryEnabled: row.deliveryEnabled ?? false,
    notificationsEnabled: row.notificationsEnabled ?? true,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    updatedBy: row.updatedBy,
    version: row.version ?? 0,
  };
}

export async function findTenantByPressingCode(
  db: Database,
  pressingCode: string,
): Promise<TenantPressingCodeRecord | null> {
  const rows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.pressingCode, pressingCode))
    .limit(1);

  return rows[0] ?? null;
}

export async function findOtherTenantByPressingCode(
  db: Database,
  pressingCode: string,
  tenantId: string,
): Promise<TenantPressingCodeRecord | null> {
  const rows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(
      and(eq(tenants.pressingCode, pressingCode), ne(tenants.id, tenantId)),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findPlatformDefaultLanguage(
  db: Database,
): Promise<SaasTenantLanguage | null> {
  const rows = await db
    .select({ defaultLanguage: platformSettings.defaultLanguage })
    .from(platformSettings)
    .where(eq(platformSettings.settingKey, "default"))
    .limit(1);

  const defaultLanguage = rows[0]?.defaultLanguage;

  return defaultLanguage ? resolveTenantLanguage(defaultLanguage) : null;
}

export async function findSaasTenants(
  db: Database,
  query: ListSaasTenantsQuery,
): Promise<SaasTenantListResult> {
  const searchQuery = normalizeSearchQuery(query.q);
  const baseWhereClause = and(
    isNull(tenants.deletedAt),
    searchQuery
      ? or(
          ilike(tenants.name, searchQuery),
          ilike(tenants.pressingCode, searchQuery),
          ilike(tenants.country, searchQuery),
          ilike(tenants.city, searchQuery),
        )
      : undefined,
  );
  const listWhereClause = and(
    baseWhereClause,
    query.status ? eq(tenants.status, query.status) : undefined,
  );
  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      pressingCode: tenants.pressingCode,
      status: tenants.status,
      country: tenants.country,
      city: tenants.city,
      createdAt: tenants.createdAt,
      updatedAt: tenants.updatedAt,
    })
    .from(tenants)
    .where(listWhereClause)
    .orderBy(desc(tenants.createdAt))
    .limit(query.limit)
    .offset(query.offset);
  const totalRows = await db
    .select({ value: count() })
    .from(tenants)
    .where(listWhereClause);
  const statusRows = await db
    .select({
      status: tenants.status,
      value: count(),
    })
    .from(tenants)
    .where(baseWhereClause)
    .groupBy(tenants.status);
  const statusCounts = createEmptyStatusCounts();

  for (const row of statusRows) {
    statusCounts[row.status as SaasTenantStatus] = row.value;
  }

  return {
    items: rows.map(toTenantSummary),
    total: totalRows[0]?.value ?? 0,
    statusCounts,
  };
}

export async function createSaasTenantRecord(
  db: Database,
  input: CreateSaasTenantRecordInput,
): Promise<SaasTenantDetail> {
  const tenantId = createId();
  const settingId = createId();
  const featureFlagsId = createId();
  const tenantRows = await db
    .insert(tenants)
    .values({
      id: tenantId,
      name: input.name,
      pressingCode: input.pressingCode,
      status: input.status ?? "active",
      country: input.country,
      city: input.city,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
    })
    .returning({ id: tenants.id });

  await db.insert(tenantSettings).values({
    id: settingId,
    tenantId,
    defaultLanguage: input.defaultLanguage,
    defaultCurrency: input.defaultCurrency,
    updatedBy: input.actorUserId,
  });

  await db.insert(tenantFeatureFlags).values({
    id: featureFlagsId,
    tenantId,
    updatedBy: input.actorUserId,
  });

  const tenant = await findSaasTenantDetailById(db, tenantRows[0].id);

  if (!tenant) {
    throw new Error("Failed to load created tenant.");
  }

  return tenant;
}

export async function findSaasTenantDetailById(
  db: Database,
  tenantId: string,
): Promise<SaasTenantDetail | null> {
  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      pressingCode: tenants.pressingCode,
      status: tenants.status,
      country: tenants.country,
      city: tenants.city,
      contactName: tenants.contactName,
      contactPhone: tenants.contactPhone,
      contactEmail: tenants.contactEmail,
      createdAt: tenants.createdAt,
      updatedAt: tenants.updatedAt,
      defaultLanguage: tenantSettings.defaultLanguage,
      defaultCurrency: tenantSettings.defaultCurrency,
      offboardedAt: tenants.offboardedAt,
      offboardReason: tenants.offboardReason,
      purgeAfter: tenants.purgeAfter,
    })
    .from(tenants)
    .leftJoin(tenantSettings, eq(tenantSettings.tenantId, tenants.id))
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
    .limit(1);

  const tenant = rows[0];

  if (!tenant) {
    return null;
  }

  const userCountRows = await db
    .select({ value: count() })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), isNull(users.deletedAt)));

  return {
    ...toTenantSummary(tenant),
    defaultLanguage: resolveTenantLanguage(tenant.defaultLanguage),
    defaultCurrency: tenant.defaultCurrency ?? "XOF",
    contactName: tenant.contactName,
    contactPhone: tenant.contactPhone,
    contactEmail: tenant.contactEmail,
    userCount: userCountRows[0]?.value ?? 0,
    // The CHECK constraint keeps these three either all set or all null, so a
    // single guard is enough to decide whether the tenant is offboarded.
    offboarding:
      tenant.offboardedAt && tenant.purgeAfter && tenant.offboardReason
        ? {
            offboardedAt: tenant.offboardedAt.toISOString(),
            offboardReason: tenant.offboardReason,
            purgeAfter: tenant.purgeAfter.toISOString(),
          }
        : null,
  };
}

export async function findSaasTenantSettingsByTenantId(
  db: Database,
  tenantId: string,
): Promise<SaasTenantSettings | null> {
  const rows = await db
    .select({
      tenantId: tenants.id,
      settingsId: tenantSettings.id,
      defaultLanguage: tenantSettings.defaultLanguage,
      defaultCurrency: tenantSettings.defaultCurrency,
      updatedAt: tenantSettings.updatedAt,
      updatedBy: tenantSettings.updatedBy,
      version: tenantSettings.version,
    })
    .from(tenants)
    .leftJoin(tenantSettings, eq(tenantSettings.tenantId, tenants.id))
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
    .limit(1);

  const settings = rows[0];

  return settings ? toTenantSettings(settings) : null;
}

export async function findSaasTenantFeatureFlagsByTenantId(
  db: Database,
  tenantId: string,
): Promise<SaasTenantFeatureFlags | null> {
  const rows = await db
    .select({
      tenantId: tenants.id,
      featureFlagsId: tenantFeatureFlags.id,
      laundryEnabled: tenantFeatureFlags.laundryEnabled,
      carWashEnabled: tenantFeatureFlags.carWashEnabled,
      retailProductsEnabled: tenantFeatureFlags.retailProductsEnabled,
      deliveryEnabled: tenantFeatureFlags.deliveryEnabled,
      notificationsEnabled: tenantFeatureFlags.notificationsEnabled,
      updatedAt: tenantFeatureFlags.updatedAt,
      updatedBy: tenantFeatureFlags.updatedBy,
      version: tenantFeatureFlags.version,
    })
    .from(tenants)
    .leftJoin(tenantFeatureFlags, eq(tenantFeatureFlags.tenantId, tenants.id))
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
    .limit(1);

  const featureFlags = rows[0];

  return featureFlags ? toTenantFeatureFlags(featureFlags) : null;
}

export async function findSaasTenantAuditSnapshotById(
  db: Database,
  tenantId: string,
): Promise<SaasTenantAuditSnapshot | null> {
  const tenant = await findSaasTenantDetailById(db, tenantId);

  if (!tenant) {
    return null;
  }

  return {
    name: tenant.name,
    pressingCode: tenant.pressingCode,
    status: tenant.status,
    country: tenant.country,
    city: tenant.city,
    defaultLanguage: tenant.defaultLanguage,
    defaultCurrency: tenant.defaultCurrency,
    contactName: tenant.contactName,
    contactPhone: tenant.contactPhone,
    contactEmail: tenant.contactEmail,
  };
}

export async function updateSaasTenantRecord(
  db: Database,
  input: UpdateSaasTenantRecordInput,
): Promise<SaasTenantDetail | null> {
  const now = new Date();
  const tenantUpdates: {
    updatedAt: Date;
    version: SQL;
    name?: string;
    pressingCode?: string;
    country?: string;
    city?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
  } = {
    updatedAt: now,
    version: sql`${tenants.version} + 1`,
  };
  let shouldUpdateTenant = false;

  if (input.data.name !== undefined) {
    tenantUpdates.name = input.data.name;
    shouldUpdateTenant = true;
  }

  if (input.data.pressingCode !== undefined) {
    tenantUpdates.pressingCode = input.data.pressingCode;
    shouldUpdateTenant = true;
  }

  if (input.data.country !== undefined) {
    tenantUpdates.country = input.data.country;
    shouldUpdateTenant = true;
  }

  if (input.data.city !== undefined) {
    tenantUpdates.city = input.data.city;
    shouldUpdateTenant = true;
  }

  if (input.data.contactName !== undefined) {
    tenantUpdates.contactName = input.data.contactName;
    shouldUpdateTenant = true;
  }

  if (input.data.contactPhone !== undefined) {
    tenantUpdates.contactPhone = input.data.contactPhone;
    shouldUpdateTenant = true;
  }

  if (input.data.contactEmail !== undefined) {
    tenantUpdates.contactEmail = input.data.contactEmail;
    shouldUpdateTenant = true;
  }

  if (shouldUpdateTenant) {
    await db
      .update(tenants)
      .set(tenantUpdates)
      .where(and(eq(tenants.id, input.tenantId), isNull(tenants.deletedAt)));
  }

  return findSaasTenantDetailById(db, input.tenantId);
}

export async function updateSaasTenantSettingsRecord(
  db: Database,
  input: UpdateSaasTenantSettingsRecordInput,
): Promise<SaasTenantSettings | null> {
  const defaultLanguage =
    input.data.defaultLanguage ?? input.currentSettings.defaultLanguage;
  const defaultCurrency =
    input.data.defaultCurrency ?? input.currentSettings.defaultCurrency;

  await db
    .insert(tenantSettings)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      defaultLanguage,
      defaultCurrency,
      updatedBy: input.actorUserId,
    })
    .onConflictDoUpdate({
      target: tenantSettings.tenantId,
      set: {
        defaultLanguage,
        defaultCurrency,
        updatedAt: new Date(),
        updatedBy: input.actorUserId,
        version: sql`${tenantSettings.version} + 1`,
      },
    });

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

  return findSaasTenantSettingsByTenantId(db, input.tenantId);
}

export async function updateSaasTenantStatusRecord(
  db: Database,
  input: UpdateSaasTenantStatusRecordInput,
): Promise<SaasTenantDetail | null> {
  await db
    .update(tenants)
    .set({
      status: input.status,
      updatedAt: new Date(),
      version: sql`${tenants.version} + 1`,
    })
    .where(and(eq(tenants.id, input.tenantId), isNull(tenants.deletedAt)));

  return findSaasTenantDetailById(db, input.tenantId);
}

export async function revokeTenantRefreshTokens(
  db: Database,
  tenantId: string,
): Promise<void> {
  await db
    .update(authRefreshTokens)
    .set({
      revokedAt: new Date(),
    })
    .where(
      and(
        eq(authRefreshTokens.tenantId, tenantId),
        isNull(authRefreshTokens.revokedAt),
      ),
    );
}

export async function updateSaasTenantFeatureFlagsRecord(
  db: Database,
  input: UpdateSaasTenantFeatureFlagsRecordInput,
): Promise<SaasTenantFeatureFlags | null> {
  const laundryEnabled =
    input.data.laundryEnabled ?? input.currentFeatureFlags.laundryEnabled;
  const carWashEnabled =
    input.data.carWashEnabled ?? input.currentFeatureFlags.carWashEnabled;
  const retailProductsEnabled =
    input.data.retailProductsEnabled ??
    input.currentFeatureFlags.retailProductsEnabled;
  const deliveryEnabled =
    input.data.deliveryEnabled ?? input.currentFeatureFlags.deliveryEnabled;
  const notificationsEnabled =
    input.data.notificationsEnabled ??
    input.currentFeatureFlags.notificationsEnabled;

  await db
    .insert(tenantFeatureFlags)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      laundryEnabled,
      carWashEnabled,
      retailProductsEnabled,
      deliveryEnabled,
      notificationsEnabled,
      updatedBy: input.actorUserId,
    })
    .onConflictDoUpdate({
      target: tenantFeatureFlags.tenantId,
      set: {
        laundryEnabled,
        carWashEnabled,
        retailProductsEnabled,
        deliveryEnabled,
        notificationsEnabled,
        updatedAt: new Date(),
        updatedBy: input.actorUserId,
        version: sql`${tenantFeatureFlags.version} + 1`,
      },
    });

  return findSaasTenantFeatureFlagsByTenantId(db, input.tenantId);
}

export async function writeSaasTenantCreatedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    tenant: SaasTenantDetail;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenant.id,
    actorUserId: input.actorUserId,
    eventCategory: "saas_tenant",
    eventType: "tenant.created",
    entityType: "tenant",
    entityId: input.tenant.id,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    after: input.tenant,
  });
}

export async function writeSaasTenantUpdatedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    tenantId: string;
    before: SaasTenantAuditSnapshot;
    after: SaasTenantAuditSnapshot;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "saas_tenant",
    eventType: "tenant.updated",
    entityType: "tenant",
    entityId: input.tenantId,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    before: input.before,
    after: input.after,
  });
}

export async function writeSaasTenantSettingsUpdatedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    settings: SaasTenantSettings;
    before: SaasTenantSettings;
    after: SaasTenantSettings;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.settings.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "saas_tenant",
    eventType: "tenant_settings.updated",
    entityType: "tenant_settings",
    entityId: input.settings.id ?? input.settings.tenantId,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    before: input.before,
    after: input.after,
  });
}

export async function writeSaasTenantFeatureFlagsUpdatedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    featureFlags: SaasTenantFeatureFlags;
    before: SaasTenantFeatureFlags;
    after: SaasTenantFeatureFlags;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.featureFlags.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "saas_tenant",
    eventType: "tenant_feature_flags.updated",
    entityType: "tenant_feature_flags",
    entityId: input.featureFlags.id ?? input.featureFlags.tenantId,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    before: input.before,
    after: input.after,
  });
}

export async function writeSaasTenantStatusChangedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    tenantId: string;
    before: SaasTenantAuditSnapshot;
    after: SaasTenantAuditSnapshot;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "saas_tenant",
    eventType: "tenant.status_updated",
    entityType: "tenant",
    entityId: input.tenantId,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    reason: input.reason,
    before: input.before,
    after: input.after,
    metadata: {
      reason: input.reason,
    },
  });
}

// ---------------------------------------------------------------------------
// Offboarding
// ---------------------------------------------------------------------------

/**
 * Start the retention countdown for a departing tenant.
 *
 * The tenant row stays intact and `deleted_at` stays null: this is reversible
 * until `purge_after` elapses. Sessions are revoked immediately, because a
 * tenant that has left should not keep working while the window runs.
 */
export async function offboardSaasTenantRecord(
  db: Database,
  input: {
    tenantId: string;
    actorUserId: string;
    reason: string;
    retentionDays: number;
  },
): Promise<SaasTenantDetail | null> {
  const now = new Date();
  const purgeAfter = new Date(
    now.getTime() + input.retentionDays * 24 * 60 * 60 * 1000,
  );

  await db
    .update(tenants)
    .set({
      status: "disabled",
      offboardedAt: now,
      offboardedBy: input.actorUserId,
      offboardReason: input.reason,
      purgeAfter,
      updatedAt: now,
      version: sql`${tenants.version} + 1`,
    })
    .where(and(eq(tenants.id, input.tenantId), isNull(tenants.deletedAt)));

  await revokeTenantRefreshTokens(db, input.tenantId);

  return findSaasTenantDetailById(db, input.tenantId);
}

/** Cancel an offboarding while the tenant is still inside its window. */
export async function restoreSaasTenantRecord(
  db: Database,
  input: {
    tenantId: string;
    actorUserId: string;
  },
): Promise<SaasTenantDetail | null> {
  const now = new Date();

  await db
    .update(tenants)
    .set({
      status: "suspended",
      offboardedAt: null,
      offboardedBy: null,
      offboardReason: null,
      purgeAfter: null,
      updatedAt: now,
      version: sql`${tenants.version} + 1`,
    })
    .where(and(eq(tenants.id, input.tenantId), isNull(tenants.deletedAt)));

  return findSaasTenantDetailById(db, input.tenantId);
}

/**
 * Soft-delete tenants whose retention window has elapsed.
 *
 * Returns the ids it marked so the caller can log them. Physical row removal
 * across the tenant-scoped tables stays a separate, deliberate operation.
 */
export async function purgeElapsedTenants(
  input: { limit: number },
  db: Database = getDb(),
): Promise<string[]> {
  const now = new Date();
  const due = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(
      and(
        isNull(tenants.deletedAt),
        sql`${tenants.purgeAfter} is not null`,
        sql`${tenants.purgeAfter} <= ${now}`,
      ),
    )
    .limit(input.limit);

  const purged: string[] = [];

  for (const tenant of due) {
    // Two overlapping purge runs (or two API replicas) select the same due
    // set. The isNull(deletedAt) guard already makes the soft delete
    // idempotent, but the audit write must not be: only the run that actually
    // claimed the row may record `tenant.purged`, or a destructive retention
    // action ends up with duplicate compliance records.
    const claimed = await db
      .update(tenants)
      .set({
        deletedAt: now,
        updatedAt: now,
        version: sql`${tenants.version} + 1`,
      })
      .where(and(eq(tenants.id, tenant.id), isNull(tenants.deletedAt)))
      .returning({ id: tenants.id });

    if (claimed.length === 0) {
      continue;
    }

    await writeAuditLog(db, {
      tenantId: tenant.id,
      actorUserId: null,
      eventCategory: "saas_tenant",
      eventType: "tenant.purged",
      entityType: "tenant",
      entityId: tenant.id,
      success: true,
      reason: "Retention window elapsed",
    });

    purged.push(tenant.id);
  }

  return purged;
}

export async function writeSaasTenantOffboardedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    tenantId: string;
    reason: string;
    purgeAfter: string;
    exportedTables: number;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "saas_tenant",
    eventType: "tenant.offboarded",
    entityType: "tenant",
    entityId: input.tenantId,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    reason: input.reason,
    metadata: {
      reason: input.reason,
      purgeAfter: input.purgeAfter,
      exportedTables: input.exportedTables,
    },
  });
}

export async function writeSaasTenantRestoredAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    tenantId: string;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "saas_tenant",
    eventType: "tenant.restored",
    entityType: "tenant",
    entityId: input.tenantId,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    reason: input.reason,
    metadata: { reason: input.reason },
  });
}

export async function writeSaasTenantExportedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    tenantId: string;
    tables: string[];
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "saas_tenant",
    eventType: "tenant.exported",
    entityType: "tenant",
    entityId: input.tenantId,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: { tableCount: input.tables.length, tables: input.tables },
  });
}

/**
 * A tenant user a SaaS operator may act on, with the roles they hold.
 *
 * Deliberately minimal: this exists to support password recovery when a store
 * has locked itself out, not to give the platform a general window into tenant
 * staff records.
 */
export type SaasTenantUserSummary = {
  id: string;
  tenantId: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  status: string;
  roleCodes: string[];
};

function tenantUserRoleCodesSql(tenantId: string) {
  return sql<string[]>`coalesce(
    (
      select array_agg(distinct ${roles.code} order by ${roles.code})
      from ${userRoles}
      inner join ${roles} on ${roles.id} = ${userRoles.roleId}
      where ${userRoles.userId} = ${users.id}
        and ${userRoles.tenantId} = ${tenantId}
        and ${userRoles.revokedAt} is null
        and ${roles.tenantId} = ${tenantId}
        and ${roles.scope} = 'tenant'
        and ${roles.status} = 'active'
        and ${roles.deletedAt} is null
    ),
    '{}'
  )`;
}

/** Tenant users a SaaS operator can see for recovery, newest first. */
export async function findSaasTenantUsers(
  db: Database,
  input: { tenantId: string },
): Promise<SaasTenantUserSummary[]> {
  const rows = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      phone: users.phone,
      displayName: userProfiles.displayName,
      status: users.status,
      roleCodes: tenantUserRoleCodesSql(input.tenantId),
    })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(users.tenantId, input.tenantId),
        eq(users.userType, "tenant"),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(desc(users.createdAt));

  return rows.map((row) => ({
    ...row,
    tenantId: row.tenantId ?? input.tenantId,
    roleCodes: row.roleCodes ?? [],
  }));
}

/** One tenant user, scoped to the tenant so an id alone cannot cross tenants. */
export async function findSaasTenantUserById(
  db: Database,
  input: { tenantId: string; userId: string },
): Promise<SaasTenantUserSummary | null> {
  const [row] = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      phone: users.phone,
      displayName: userProfiles.displayName,
      status: users.status,
      roleCodes: tenantUserRoleCodesSql(input.tenantId),
    })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(users.id, input.userId),
        eq(users.tenantId, input.tenantId),
        eq(users.userType, "tenant"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    ...row,
    tenantId: row.tenantId ?? input.tenantId,
    roleCodes: row.roleCodes ?? [],
  };
}

export async function writeSaasTenantUserPasswordResetAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    tenantId: string;
    userId: string;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "saas_tenant",
    eventType: "saas_tenant.user_password_reset",
    entityType: "user",
    entityId: input.userId,
    success: true,
    reason: input.reason,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}
