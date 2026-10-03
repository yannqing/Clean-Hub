import { getDb, posChannelSettings, type Database } from "@cleanhub/db";
import { eq } from "drizzle-orm";
import { isReadyTaxTemplate } from "../../tax/tax-template-readiness.js";
import { ApplyTaxTemplateError, syncTaxTemplateForTenant } from "../../tenant/tax-rates/tax-template.service.js";

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
import { assertPasswordMeetsPolicy } from "../../auth/password-policy.helper.js";
import { hashPassword } from "../../auth/password.service.js";
import { generateTemporaryPassword } from "../../auth/temporary-password.helper.js";
import {
  revokeTenantUserRefreshTokens,
  updateTenantUserPasswordRecord,
} from "../../tenant/users/tenant-users.repository.js";
import { resolveEffectiveSecurityPolicy } from "../security/security-policy.js";
import {
  createTenantOwnerUser,
  TenantOwnerUserHelperError,
} from "./tenant-owner-user.helper.js";
import { SaasTenantsError } from "./tenants.errors.js";
import {
  createSaasTenantRecord,
  alignTenantBranchCurrency,
  findPlatformTaxTemplateForCountry,
  hasTenantBranchCurrencyMismatch,
  hasTenantMonetaryData,
  findSaasTenantFeatureFlagsByTenantId,
  findOtherTenantByPressingCode,
  findPlatformDefaultLanguage,
  findSaasTenantAuditSnapshotById,
  findSaasTenantDetailById,
  findSaasTenantSettingsByTenantId,
  findSaasTenants,
  findSaasTenantUserById,
  findSaasTenantUsers,
  findTenantByPressingCode,
  revokeTenantRefreshTokens,
  updateSaasTenantFeatureFlagsRecord,
  updateSaasTenantRecord,
  updateSaasTenantSettingsRecord,
  updateSaasTenantStatusRecord,
  writeSaasTenantCreatedAuditLog,
  writeSaasTenantFeatureFlagsUpdatedAuditLog,
  writeSaasTenantSettingsUpdatedAuditLog,
  offboardSaasTenantRecord,
  restoreSaasTenantRecord,
  writeSaasTenantExportedAuditLog,
  writeSaasTenantOffboardedAuditLog,
  writeSaasTenantRestoredAuditLog,
  writeSaasTenantStatusChangedAuditLog,
  writeSaasTenantUserPasswordResetAuditLog,
  type SaasTenantUserSummary,
  writeSaasTenantUpdatedAuditLog,
} from "./tenants.repository.js";
import { buildTenantExportArchive } from "./tenant-export.service.js";
import type {
  CreateSaasTenantInput,
  CreateSaasTenantResult,
  ExportSaasTenantInput,
  GetSaasTenantFeatureFlagsInput,
  GetSaasTenantSettingsInput,
  GetSaasTenantDetailInput,
  ListSaasTenantsInput,
  ListSaasTenantUsersInput,
  ResetSaasTenantUserPasswordInput,
  ResetSaasTenantUserPasswordResult,
  OffboardSaasTenantInput,
  RestoreSaasTenantInput,
  SaasTenantDetail,
  SaasTenantExport,
  SaasTenantFeatureFlags,
  SaasTenantLanguage,
  SaasTenantListResult,
  SaasTenantSettings,
  UpdateSaasTenantFeatureFlagsInput,
  UpdateSaasTenantInput,
  UpdateSaasTenantSettingsInput,
  UpdateSaasTenantStatusInput,
} from "./tenants.types.js";
import { DEFAULT_TENANT_RETENTION_DAYS } from "./tenants.validation.js";
import { findPlatformSettings } from "../platform-settings/platform-settings.repository.js";

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

      const platformDefaults = await findPlatformSettings(tx);
      const taxTemplate = await findPlatformTaxTemplateForCountry(tx, input.data.country);
      if (!taxTemplate || !isReadyTaxTemplate(taxTemplate) || !taxTemplate.taxEnabled) {
        throw new SaasTenantsError(
          "SAAS_TENANT_TAX_TEMPLATE_REQUIRED",
            "Configure and enable the country's tax template before creating a tenant.",
          422,
        );
      }
      if (input.data.defaultCurrency && input.data.defaultCurrency !== taxTemplate.currencyCode) {
        throw new SaasTenantsError(
          "SAAS_TENANT_CURRENCY_MISMATCH",
          "Tenant currency must match the selected country's tax template.",
          422,
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
        defaultCurrency: taxTemplate.currencyCode!,
        timezone: platformDefaults?.timezone ?? "UTC",
        taxTemplate,
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

      let country = input.data.country;
      if (country !== undefined && country !== before.country) {
        const template = await findPlatformTaxTemplateForCountry(tx, country);
        if (!template || !isReadyTaxTemplate(template) || !template.taxEnabled) {
          throw new SaasTenantsError(
            "SAAS_TENANT_TAX_TEMPLATE_REQUIRED",
            "Configure and enable the country's tax template before changing the tenant country.",
            422,
          );
        }
        country = template.countryCode;
        const previousTemplate = before.country
          ? await findPlatformTaxTemplateForCountry(tx, before.country)
          : null;
        const settings = await findSaasTenantSettingsByTenantId(tx, input.tenantId);
        if (!settings) {
          throw new SaasTenantsError("SAAS_TENANT_SETTINGS_NOT_FOUND", "Tenant settings were not found.", 409);
        }
        const branchCurrencyMismatch = await hasTenantBranchCurrencyMismatch(
          tx, input.tenantId, template.currencyCode!,
        );
        if (settings.defaultCurrency !== template.currencyCode || branchCurrencyMismatch) {
          if (await hasTenantMonetaryData(tx, input.tenantId)) {
            throw new SaasTenantsError(
              "SAAS_TENANT_CURRENCY_IN_USE",
              "This tenant has sales, saved carts, catalog prices, or enrolled terminals. A currency change requires a dedicated migration before changing country.",
              409,
            );
          }
          if (settings.defaultCurrency !== template.currencyCode) {
            await updateSaasTenantSettingsRecord(tx, {
              actorUserId: input.authContext.userId,
              tenantId: input.tenantId,
              data: { defaultCurrency: template.currencyCode! },
              currentSettings: settings,
            });
          } else {
            await alignTenantBranchCurrency(tx, {
              actorUserId: input.authContext.userId,
              tenantId: input.tenantId,
              currency: template.currencyCode!,
            });
          }
        }
        try {
          await syncTaxTemplateForTenant(tx, {
            tenantId: input.tenantId,
            actorUserId: input.authContext.userId,
            template,
          });
        } catch (error) {
          if (error instanceof ApplyTaxTemplateError) {
            throw new SaasTenantsError("SAAS_TENANT_TAX_TEMPLATE_CONFLICT", error.message, error.status);
          }
          throw error;
        }
        if (previousTemplate?.countryCode !== template.countryCode) {
          // The previous country's tax identity cannot be used on new receipts.
          await tx.update(posChannelSettings)
            .set({ taxRegistrationNumber: null })
            .where(eq(posChannelSettings.tenantId, input.tenantId));
        }
      }

      const tenant = await updateSaasTenantRecord(tx, {
        actorUserId: input.authContext.userId,
        tenantId: input.tenantId,
        data: {
          ...input.data,
          pressingCode,
          country,
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

    if (input.data.defaultCurrency !== undefined &&
        input.data.defaultCurrency !== before.defaultCurrency) {
      const tenant = await findSaasTenantAuditSnapshotById(tx, input.tenantId);
      const template = tenant?.country
        ? await findPlatformTaxTemplateForCountry(tx, tenant.country)
        : null;
      if (!template || !isReadyTaxTemplate(template) ||
          input.data.defaultCurrency !== template.currencyCode) {
        throw new SaasTenantsError(
          "SAAS_TENANT_CURRENCY_MISMATCH",
          "Tenant currency must match the country's configured tax template. Change the country on the tenant detail page instead.",
          422,
        );
      }
      if (await hasTenantMonetaryData(tx, input.tenantId)) {
        throw new SaasTenantsError(
          "SAAS_TENANT_CURRENCY_IN_USE",
          "This tenant has sales, saved carts, catalog prices, or enrolled terminals. A currency change requires a dedicated migration.",
          409,
        );
      }
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

/**
 * Export every tenant-scoped table as a zip of CSVs.
 *
 * Restricted to `super_admin` rather than the broader write permission: this
 * returns the tenant's entire business dataset in one file, which is a much
 * larger disclosure than any single console screen.
 */
export async function exportSaasTenant(
  input: ExportSaasTenantInput,
  db: Database = getDb(),
): Promise<SaasTenantExport> {
  requireSaasTenantsAccess(input.authContext, ["super_admin"]);

  const tenant = await findSaasTenantDetailById(db, input.tenantId);

  if (!tenant) {
    throw new SaasTenantsError(
      "SAAS_TENANT_NOT_FOUND",
      "SaaS tenant was not found.",
      404,
    );
  }

  const archive = await buildTenantExportArchive(input.tenantId, db);

  await writeSaasTenantExportedAuditLog(db, {
    actorUserId: input.authContext.userId,
    tenantId: input.tenantId,
    tables: archive.tables,
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });

  return {
    fileName: `${tenant.pressingCode}-export-${new Date().toISOString().slice(0, 10)}.zip`,
    content: archive.content,
    tables: archive.tables,
  };
}

/**
 * Start a tenant's offboarding: disable access now, keep the data until the
 * retention window elapses.
 *
 * An export is taken first so the operator always has the data as it stood at
 * the moment access was cut, even if the purge later runs. It is built outside
 * the transaction on purpose: the export reads every tenant-scoped table, and
 * holding the tenant row lock for that long would block POS logins meanwhile.
 * The cost is that rows written during the export may be missed, which is the
 * better trade for a tenant that is leaving anyway.
 */
export async function offboardSaasTenant(
  input: OffboardSaasTenantInput,
  db: Database = getDb(),
): Promise<{ tenant: SaasTenantDetail; export: SaasTenantExport }> {
  requireSaasTenantsAccess(input.authContext, ["super_admin"]);

  const existing = await findSaasTenantDetailById(db, input.tenantId);

  if (!existing) {
    throw new SaasTenantsError(
      "SAAS_TENANT_NOT_FOUND",
      "SaaS tenant was not found.",
      404,
    );
  }

  if (existing.offboarding) {
    throw new SaasTenantsError(
      "SAAS_TENANT_ALREADY_OFFBOARDED",
      "Tenant is already offboarded.",
      409,
    );
  }

  const tenantExport = await exportSaasTenant(
    {
      authContext: input.authContext,
      requestMeta: input.requestMeta,
      tenantId: input.tenantId,
    },
    db,
  );

  const retentionDays =
    input.data.retentionDays ?? DEFAULT_TENANT_RETENTION_DAYS;

  const tenant = await db.transaction(async (tx) => {
    // Offboarding disables the tenant, so it has to close POS access the same
    // way a suspension does. Skipping this would leave enrolled terminals
    // signed in against a tenant that is no longer entitled to the service.
    await lockPosTerminalsForTenantStatusChange(tx, input.tenantId);

    const updated = await offboardSaasTenantRecord(tx, {
      tenantId: input.tenantId,
      actorUserId: input.authContext.userId,
      reason: input.data.reason,
      retentionDays,
    });

    if (!updated) {
      throw new SaasTenantsError(
        "SAAS_TENANT_NOT_FOUND",
        "SaaS tenant was not found.",
        404,
      );
    }

    // Re-scan under the tenant row lock to catch a terminal enrolled between
    // the first scan and this update.
    const finalLockedTerminals =
      await lockPosTerminalsForTenantStatusChange(tx, input.tenantId);
    const terminalIds = finalLockedTerminals.map((terminal) => terminal.id);
    const metadata = { securityTrigger: "tenant_offboarding" };

    await securityForceClosePosTerminalShifts(tx, {
      tenantId: input.tenantId,
      terminalIds,
      actorUserId: input.authContext.userId,
      reason: input.data.reason,
      metadata,
      requestMeta: input.requestMeta,
    });
    await securityForceClosePosTerminalRegisterSessions(tx, {
      tenantId: input.tenantId,
      terminalIds,
      actorUserId: input.authContext.userId,
      reason: input.data.reason,
      metadata,
      requestMeta: input.requestMeta,
    });
    await invalidateLockedPosTerminalsForTenantStatusChange(tx, {
      tenantId: input.tenantId,
      previousTenantStatus: existing.status,
      tenantStatus: "disabled",
      actorUserId: input.authContext.userId,
      reason: input.data.reason,
      terminals: finalLockedTerminals,
      requestMeta: input.requestMeta,
    });

    await writeSaasTenantOffboardedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: input.tenantId,
      reason: input.data.reason,
      purgeAfter: updated.offboarding?.purgeAfter ?? "",
      exportedTables: tenantExport.tables.length,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return updated;
  });

  return { tenant, export: tenantExport };
}

/**
 * Cancel an offboarding while the tenant is still inside its retention window.
 *
 * The tenant comes back `suspended`, not `active`: reinstating billing and POS
 * access should be a separate, deliberate decision rather than a side effect of
 * undoing the offboarding.
 */
export async function restoreSaasTenant(
  input: RestoreSaasTenantInput,
  db: Database = getDb(),
): Promise<SaasTenantDetail> {
  requireSaasTenantsAccess(input.authContext, ["super_admin"]);

  return db.transaction(async (tx) => {
    const existing = await findSaasTenantDetailById(tx, input.tenantId);

    if (!existing) {
      throw new SaasTenantsError(
        "SAAS_TENANT_NOT_FOUND",
        "SaaS tenant was not found.",
        404,
      );
    }

    if (!existing.offboarding) {
      throw new SaasTenantsError(
        "SAAS_TENANT_NOT_OFFBOARDED",
        "Tenant is not offboarded.",
        409,
      );
    }

    const tenant = await restoreSaasTenantRecord(tx, {
      tenantId: input.tenantId,
      actorUserId: input.authContext.userId,
    });

    if (!tenant) {
      throw new SaasTenantsError(
        "SAAS_TENANT_NOT_FOUND",
        "SaaS tenant was not found.",
        404,
      );
    }

    await writeSaasTenantRestoredAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: input.tenantId,
      reason: input.data.reason,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return tenant;
  });
}

/**
 * Tenant staff a SaaS operator can see, for recovery purposes.
 *
 * Read-only and deliberately narrow: enough to find the right person to reset,
 * not a general window into a tenant's staff records.
 */
export async function listSaasTenantUsers(
  input: ListSaasTenantUsersInput,
  db: Database = getDb(),
): Promise<SaasTenantUserSummary[]> {
  requireSaasTenantsAccess(input.authContext, ["super_admin", "support"]);

  const tenant = await findSaasTenantDetailById(db, input.tenantId);

  if (!tenant) {
    throw new SaasTenantsError(
      "SAAS_TENANT_NOT_FOUND",
      "Tenant was not found.",
      404,
    );
  }

  return findSaasTenantUsers(db, { tenantId: input.tenantId });
}

/**
 * Reset a tenant user's password from the SaaS console.
 *
 * Tenant-side password reset needs an owner or manager *inside* that tenant,
 * so a single-owner store that loses its password has nobody who can help it.
 * This is the platform's way back in, and it is restricted to super admins:
 * it hands out a credential for somebody else's business.
 *
 * Mirrors resetSaasUserPassword -- generate, assert against policy, hash,
 * revoke the target's sessions, and audit with a mandatory reason -- so both
 * reset paths behave the same way.
 */
export async function resetSaasTenantUserPassword(
  input: ResetSaasTenantUserPasswordInput,
  db: Database = getDb(),
): Promise<ResetSaasTenantUserPasswordResult> {
  requireSaasTenantsAccess(input.authContext, ["super_admin"]);

  return db.transaction(async (tx) => {
    const tenant = await findSaasTenantDetailById(tx, input.tenantId);

    if (!tenant) {
      throw new SaasTenantsError(
        "SAAS_TENANT_NOT_FOUND",
        "Tenant was not found.",
        404,
      );
    }

    // Scoped by tenant as well as id, so a user id from one tenant cannot be
    // reset through another tenant's URL.
    const target = await findSaasTenantUserById(tx, {
      tenantId: input.tenantId,
      userId: input.userId,
    });

    if (!target) {
      throw new SaasTenantsError(
        "SAAS_TENANT_USER_NOT_FOUND",
        "Tenant user was not found.",
        404,
      );
    }

    const securityPolicy = await resolveEffectiveSecurityPolicy(tx);
    const temporaryPassword = generateTemporaryPassword();

    // The generated password is built to satisfy the policy, but assert it so a
    // future policy change fails loudly instead of silently producing an
    // unusable credential.
    assertPasswordMeetsPolicy(temporaryPassword, securityPolicy);

    const passwordHash = await hashPassword(temporaryPassword);

    await updateTenantUserPasswordRecord(tx, {
      tenantId: input.tenantId,
      userId: input.userId,
      passwordHash,
    });

    // Invalidate existing sessions so the new password takes effect on the next
    // sign-in, and so a stolen session cannot outlive the reset.
    await revokeTenantUserRefreshTokens(tx, {
      tenantId: input.tenantId,
      userId: input.userId,
    });

    await writeSaasTenantUserPasswordResetAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: input.tenantId,
      userId: input.userId,
      reason: input.reason,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return { userId: target.id, temporaryPassword };
  });
}
