import { getDb, type Database } from "@cleanhub/db";

import { AuthError } from "../auth/auth.errors.js";
import type { AuthContext } from "../auth/auth.types.js";
import { requireSaasRole, type SaasRole } from "../auth/permission.helper.js";
import { SaasTenantsError } from "./tenants.errors.js";
import {
  createSaasTenantRecord,
  findSaasTenantFeatureFlagsByTenantId,
  findOtherTenantByPressingCode,
  findPlatformDefaultLanguage,
  findSaasTenantAuditSnapshotById,
  findSaasTenantDetailById,
  findSaasTenantSettingsByTenantId,
  findSaasTenants,
  findTenantByPressingCode,
  updateSaasTenantFeatureFlagsRecord,
  updateSaasTenantRecord,
  updateSaasTenantSettingsRecord,
  updateSaasTenantStatusRecord,
  writeSaasTenantCreatedAuditLog,
  writeSaasTenantFeatureFlagsUpdatedAuditLog,
  writeSaasTenantSettingsUpdatedAuditLog,
  writeSaasTenantStatusChangedAuditLog,
  writeSaasTenantUpdatedAuditLog,
} from "./tenants.repository.js";
import type {
  CreateSaasTenantInput,
  GetSaasTenantFeatureFlagsInput,
  GetSaasTenantSettingsInput,
  GetSaasTenantDetailInput,
  ListSaasTenantsInput,
  SaasTenantDetail,
  SaasTenantFeatureFlags,
  SaasTenantLanguage,
  SaasTenantListResult,
  SaasTenantSettings,
  UpdateSaasTenantFeatureFlagsInput,
  UpdateSaasTenantInput,
  UpdateSaasTenantSettingsInput,
  UpdateSaasTenantStatusInput,
} from "./tenants.types.js";

function requireSaasTenantsAccess(
  authContext: AuthContext,
  allowedRoles: SaasRole[],
): void {
  requireSaasRole(authContext, allowedRoles);

  if (authContext.tenantId !== null) {
    throw new AuthError("FORBIDDEN", "Tenant users cannot access SaaS tenants.");
  }
}

function normalizePressingCode(value: string): string {
  return value.trim().toUpperCase();
}

async function resolveDefaultLanguage(
  db: Database,
  inputLanguage: SaasTenantLanguage | undefined,
): Promise<SaasTenantLanguage> {
  if (inputLanguage) {
    return inputLanguage;
  }

  return (await findPlatformDefaultLanguage(db)) ?? "en";
}

export async function listSaasTenants(
  input: ListSaasTenantsInput,
  db: Database = getDb(),
): Promise<SaasTenantListResult> {
  requireSaasTenantsAccess(input.authContext, ["super_admin", "support"]);

  return findSaasTenants(db, input.query);
}

export async function getSaasTenantDetail(
  input: GetSaasTenantDetailInput,
  db: Database = getDb(),
): Promise<SaasTenantDetail> {
  requireSaasTenantsAccess(input.authContext, ["super_admin", "support"]);

  const tenant = await findSaasTenantDetailById(db, input.tenantId);

  if (!tenant) {
    throw new SaasTenantsError(
      "SAAS_TENANT_NOT_FOUND",
      "SaaS tenant was not found.",
      404,
    );
  }

  return tenant;
}

export async function createSaasTenant(
  input: CreateSaasTenantInput,
  db: Database = getDb(),
): Promise<SaasTenantDetail> {
  requireSaasTenantsAccess(input.authContext, ["super_admin"]);

  const pressingCode = normalizePressingCode(input.data.pressingCode);

  return db.transaction(async (tx) => {
    const existingTenant = await findTenantByPressingCode(tx, pressingCode);

    if (existingTenant) {
      throw new SaasTenantsError(
        "SAAS_TENANT_PRESSING_CODE_CONFLICT",
        "A tenant with this pressing code already exists.",
        409,
      );
    }

    const defaultLanguage = await resolveDefaultLanguage(
      tx,
      input.data.defaultLanguage,
    );
    const tenant = await createSaasTenantRecord(tx, {
      ...input.data,
      actorUserId: input.authContext.userId,
      pressingCode,
      defaultLanguage,
    });

    await writeSaasTenantCreatedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenant,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return tenant;
  });
}

export async function updateSaasTenant(
  input: UpdateSaasTenantInput,
  db: Database = getDb(),
): Promise<SaasTenantDetail> {
  requireSaasTenantsAccess(input.authContext, ["super_admin"]);

  if (!Object.values(input.data).some((value) => value !== undefined)) {
    throw new SaasTenantsError(
      "SAAS_TENANT_UPDATE_EMPTY",
      "At least one tenant field must be provided.",
      422,
    );
  }

  const pressingCode =
    input.data.pressingCode !== undefined
      ? normalizePressingCode(input.data.pressingCode)
      : undefined;

  return db.transaction(async (tx) => {
    const before = await findSaasTenantAuditSnapshotById(tx, input.tenantId);

    if (!before) {
      throw new SaasTenantsError(
        "SAAS_TENANT_NOT_FOUND",
        "SaaS tenant was not found.",
        404,
      );
    }

    if (pressingCode !== undefined) {
      const existingTenant = await findOtherTenantByPressingCode(
        tx,
        pressingCode,
        input.tenantId,
      );

      if (existingTenant) {
        throw new SaasTenantsError(
          "SAAS_TENANT_PRESSING_CODE_CONFLICT",
          "A tenant with this pressing code already exists.",
          409,
        );
      }
    }

    const tenant = await updateSaasTenantRecord(tx, {
      actorUserId: input.authContext.userId,
      tenantId: input.tenantId,
      data: {
        ...input.data,
        pressingCode,
      },
    });

    if (!tenant) {
      throw new SaasTenantsError(
        "SAAS_TENANT_NOT_FOUND",
        "SaaS tenant was not found.",
        404,
      );
    }

    const after = await findSaasTenantAuditSnapshotById(tx, input.tenantId);

    if (!after) {
      throw new SaasTenantsError(
        "SAAS_TENANT_NOT_FOUND",
        "SaaS tenant was not found.",
        404,
      );
    }

    await writeSaasTenantUpdatedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: input.tenantId,
      before,
      after,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return tenant;
  });
}

export async function getSaasTenantSettings(
  input: GetSaasTenantSettingsInput,
  db: Database = getDb(),
): Promise<SaasTenantSettings> {
  requireSaasTenantsAccess(input.authContext, ["super_admin", "support"]);

  const settings = await findSaasTenantSettingsByTenantId(db, input.tenantId);

  if (!settings) {
    throw new SaasTenantsError(
      "SAAS_TENANT_NOT_FOUND",
      "SaaS tenant was not found.",
      404,
    );
  }

  return settings;
}

export async function updateSaasTenantSettings(
  input: UpdateSaasTenantSettingsInput,
  db: Database = getDb(),
): Promise<SaasTenantSettings> {
  requireSaasTenantsAccess(input.authContext, ["super_admin"]);

  return db.transaction(async (tx) => {
    const before = await findSaasTenantSettingsByTenantId(tx, input.tenantId);

    if (!before) {
      throw new SaasTenantsError(
        "SAAS_TENANT_NOT_FOUND",
        "SaaS tenant was not found.",
        404,
      );
    }

    const settings = await updateSaasTenantSettingsRecord(tx, {
      actorUserId: input.authContext.userId,
      tenantId: input.tenantId,
      data: input.data,
      currentSettings: before,
    });

    if (!settings) {
      throw new SaasTenantsError(
        "SAAS_TENANT_NOT_FOUND",
        "SaaS tenant was not found.",
        404,
      );
    }

    await writeSaasTenantSettingsUpdatedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      settings,
      before,
      after: settings,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return settings;
  });
}

export async function getSaasTenantFeatureFlags(
  input: GetSaasTenantFeatureFlagsInput,
  db: Database = getDb(),
): Promise<SaasTenantFeatureFlags> {
  requireSaasTenantsAccess(input.authContext, ["super_admin", "support"]);

  const featureFlags = await findSaasTenantFeatureFlagsByTenantId(
    db,
    input.tenantId,
  );

  if (!featureFlags) {
    throw new SaasTenantsError(
      "SAAS_TENANT_NOT_FOUND",
      "SaaS tenant was not found.",
      404,
    );
  }

  return featureFlags;
}

export async function updateSaasTenantFeatureFlags(
  input: UpdateSaasTenantFeatureFlagsInput,
  db: Database = getDb(),
): Promise<SaasTenantFeatureFlags> {
  requireSaasTenantsAccess(input.authContext, ["super_admin"]);

  return db.transaction(async (tx) => {
    const before = await findSaasTenantFeatureFlagsByTenantId(
      tx,
      input.tenantId,
    );

    if (!before) {
      throw new SaasTenantsError(
        "SAAS_TENANT_NOT_FOUND",
        "SaaS tenant was not found.",
        404,
      );
    }

    const featureFlags = await updateSaasTenantFeatureFlagsRecord(tx, {
      actorUserId: input.authContext.userId,
      tenantId: input.tenantId,
      data: input.data,
      currentFeatureFlags: before,
    });

    if (!featureFlags) {
      throw new SaasTenantsError(
        "SAAS_TENANT_NOT_FOUND",
        "SaaS tenant was not found.",
        404,
      );
    }

    await writeSaasTenantFeatureFlagsUpdatedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      featureFlags,
      before,
      after: featureFlags,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return featureFlags;
  });
}

export async function updateSaasTenantStatus(
  input: UpdateSaasTenantStatusInput,
  db: Database = getDb(),
): Promise<SaasTenantDetail> {
  requireSaasTenantsAccess(input.authContext, ["super_admin"]);

  return db.transaction(async (tx) => {
    const before = await findSaasTenantAuditSnapshotById(tx, input.tenantId);

    if (!before) {
      throw new SaasTenantsError(
        "SAAS_TENANT_NOT_FOUND",
        "SaaS tenant was not found.",
        404,
      );
    }

    const tenant = await updateSaasTenantStatusRecord(tx, {
      tenantId: input.tenantId,
      status: input.data.status,
    });

    if (!tenant) {
      throw new SaasTenantsError(
        "SAAS_TENANT_NOT_FOUND",
        "SaaS tenant was not found.",
        404,
      );
    }

    const after = await findSaasTenantAuditSnapshotById(tx, input.tenantId);

    if (!after) {
      throw new SaasTenantsError(
        "SAAS_TENANT_NOT_FOUND",
        "SaaS tenant was not found.",
        404,
      );
    }

    await writeSaasTenantStatusChangedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: input.tenantId,
      before,
      after,
      reason: input.data.reason,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return tenant;
  });
}
