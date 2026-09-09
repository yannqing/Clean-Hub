import { getDb, type Database } from "@cleanhub/db";

import { AuthError } from "../../auth/auth.errors.js";
import type { AuthContext } from "../../auth/auth.types.js";
import {
  assertSaasContext,
  hasPermission,
  requireSaasRole,
  type SaasRole,
} from "../../auth/permission.helper.js";
import {
  invalidateLockedPosTerminalsForTenantStatusChange,
  lockPosTerminalsForTenantStatusChange,
  securityForceClosePosTerminalRegisterSessions,
  securityForceClosePosTerminalShifts,
} from "../../pos/terminal-lifecycle/terminal-lifecycle.repository.js";
import {
  createTenantOwnerUser,
  TenantOwnerUserHelperError,
} from "./tenant-owner-user.helper.js";
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
  revokeTenantRefreshTokens,
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
  CreateSaasTenantResult,
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
    throw new AuthError(
      "FORBIDDEN",
      "Tenant users cannot access SaaS tenants.",
    );
  }
}

function requireSaasTenantsWriteAccess(authContext: AuthContext): void {
  assertSaasContext(authContext);

  if (authContext.tenantId !== null) {
    throw new AuthError(
      "FORBIDDEN",
      "Tenant users cannot access SaaS tenants.",
    );
  }

  if (
    authContext.role !== "super_admin" &&
    !hasPermission(authContext, "saas:tenant:write")
  ) {
    throw new AuthError("FORBIDDEN", "User does not have enough permission.");
  }
}

function normalizePressingCode(value: string): string {
  return value.trim().toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isPressingCodeUniqueViolation(
  error: unknown,
  seen = new Set<unknown>(),
): boolean {
  if (!isRecord(error) || seen.has(error)) {
    return false;
  }

  seen.add(error);

  const constraint = error.constraint;
  const detail = error.detail;

  if (
    error.code === "23505" &&
    ((typeof constraint === "string" &&
      constraint.toLowerCase().includes("pressing")) ||
      (typeof detail === "string" &&
        detail.toLowerCase().includes("pressing_code")))
  ) {
    return true;
  }

  return isPressingCodeUniqueViolation(error.cause, seen);
}

function createPressingCodeConflictError(): SaasTenantsError {
  return new SaasTenantsError(
    "SAAS_TENANT_PRESSING_CODE_CONFLICT",
    "A tenant with this pressing code already exists.",
    409,
  );
}

function hasUpdateField(data: object): boolean {
  return Object.values(data).some((value) => value !== undefined);
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
): Promise<CreateSaasTenantResult> {
  requireSaasTenantsAccess(input.authContext, ["super_admin"]);

  const pressingCode = normalizePressingCode(input.data.pressingCode);

  try {
    return await db.transaction(async (tx) => {
      const existingTenant = await findTenantByPressingCode(tx, pressingCode);

      if (existingTenant) {
        throw createPressingCodeConflictError();
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
      const initialOwner = input.data.initialOwner
        ? await createTenantOwnerUser(tx, {
            ...input.data.initialOwner,
            tenantId: tenant.id,
            actorUserId: input.authContext.userId,
            ipAddress: input.requestMeta?.ipAddress,
            userAgent: input.requestMeta?.userAgent,
          })
        : undefined;
      const tenantWithUsers = initialOwner
        ? await findSaasTenantDetailById(tx, tenant.id)
        : tenant;

      await writeSaasTenantCreatedAuditLog(tx, {
        actorUserId: input.authContext.userId,
        tenant: tenantWithUsers ?? tenant,
        ipAddress: input.requestMeta?.ipAddress,
        userAgent: input.requestMeta?.userAgent,
      });

      return {
        ...(tenantWithUsers ?? tenant),
        initialOwnerUserId: initialOwner?.id,
      };
    });
  } catch (error) {
    if (isPressingCodeUniqueViolation(error)) {
      throw createPressingCodeConflictError();
    }

    if (error instanceof TenantOwnerUserHelperError) {
      throw new SaasTenantsError(error.code, error.message, error.status);
    }

    throw error;
  }
}

export async function updateSaasTenant(
  input: UpdateSaasTenantInput,
  db: Database = getDb(),
): Promise<SaasTenantDetail> {
  requireSaasTenantsWriteAccess(input.authContext);

  if (!hasUpdateField(input.data)) {
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

  try {
    return await db.transaction(async (tx) => {
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
          throw createPressingCodeConflictError();
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
  } catch (error) {
    if (isPressingCodeUniqueViolation(error)) {
      throw createPressingCodeConflictError();
    }

    throw error;
  }
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
  requireSaasTenantsWriteAccess(input.authContext);

  if (!hasUpdateField(input.data)) {
    throw new SaasTenantsError(
      "SAAS_TENANT_SETTINGS_UPDATE_EMPTY",
      "At least one tenant setting must be provided.",
      422,
    );
  }

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
  requireSaasTenantsWriteAccess(input.authContext);

  if (!hasUpdateField(input.data)) {
    throw new SaasTenantsError(
      "SAAS_TENANT_FEATURE_FLAGS_UPDATE_EMPTY",
      "At least one tenant feature flag must be provided.",
      422,
    );
  }

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

    if (before.status === input.data.status) {
      throw new SaasTenantsError(
        "SAAS_TENANT_STATUS_UNCHANGED",
        "Tenant already has this status.",
        409,
      );
    }

    // POS security transitions use one terminal-first lock order. This
    // serializes tenant suspension/activation with terminal logins, refresh,
    // and shift clock-in without permanently disabling enrolled devices.
    await lockPosTerminalsForTenantStatusChange(tx, input.tenantId);

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

    // The tenant row is now write-locked. Catch a terminal enrollment that
    // committed after the initial terminal scan but before this status update
    // acquired the tenant row lock.
    const finalLockedTerminals =
      await lockPosTerminalsForTenantStatusChange(tx, input.tenantId);

    if (input.data.status !== "active") {
      await securityForceClosePosTerminalShifts(tx, {
        tenantId: input.tenantId,
        terminalIds: finalLockedTerminals.map((terminal) => terminal.id),
        actorUserId: input.authContext.userId,
        reason: input.data.reason,
        metadata: {
          securityTrigger: "tenant_status_change",
          tenantStatus: input.data.status,
        },
        requestMeta: input.requestMeta,
      });
      await securityForceClosePosTerminalRegisterSessions(tx, {
        tenantId: input.tenantId,
        terminalIds: finalLockedTerminals.map((terminal) => terminal.id),
        actorUserId: input.authContext.userId,
        reason: input.data.reason,
        metadata: {
          securityTrigger: "tenant_status_change",
          tenantStatus: input.data.status,
        },
        requestMeta: input.requestMeta,
      });
    }

    await invalidateLockedPosTerminalsForTenantStatusChange(tx, {
      tenantId: input.tenantId,
      previousTenantStatus: before.status,
      tenantStatus: input.data.status,
      actorUserId: input.authContext.userId,
      reason: input.data.reason,
      terminals: finalLockedTerminals,
      requestMeta: input.requestMeta,
    });

    if (input.data.status !== "active") {
      await revokeTenantRefreshTokens(tx, input.tenantId);
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
