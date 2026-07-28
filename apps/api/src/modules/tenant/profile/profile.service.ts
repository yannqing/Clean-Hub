import { getDb, type Database } from "@cleanhub/db";

import { resolveAllowedBranchIds } from "../../auth/branch-scope.helper.js";
import { validatePasswordAgainstPolicy } from "../../auth/password-policy.helper.js";
import { hashPassword, verifyPassword } from "../../auth/password.service.js";
import {
  assertActiveTenant,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { resolveEffectiveSecurityPolicy } from "../../saas/security/security-policy.js";
import { TenantProfileError } from "./profile.errors.js";
import {
  findTenantSelfProfile,
  findTenantUserCredential,
  revokeTenantUserRefreshTokens,
  updateTenantSelfProfileRecord,
  updateTenantUserPasswordRecord,
  writeTenantPasswordChangedAuditLog,
  writeTenantProfileUpdatedAuditLog,
} from "./profile.repository.js";
import type {
  ChangeTenantProfilePasswordRequest,
  ChangeTenantProfilePasswordResult,
  TenantProfile,
  TenantProfileMutableFields,
  TenantProfileRecord,
  TenantProfileRequestInput,
  UpdateTenantProfileRequest,
} from "./profile.types.js";

function requireTenantId(
  authContext: TenantProfileRequestInput<unknown>["authContext"],
): string {
  requireTenantRole(authContext, ["owner", "manager"]);
  return authContext.tenantId!;
}

async function loadSelfProfile(
  db: Database,
  input: {
    authContext: TenantProfileRequestInput<unknown>["authContext"];
    tenantId: string;
  },
): Promise<TenantProfileRecord> {
  const branchScope = await resolveAllowedBranchIds(input.authContext, db);
  const profile = await findTenantSelfProfile(db, {
    tenantId: input.tenantId,
    userId: input.authContext.userId,
    allowedBranchIds: branchScope === "all" ? undefined : branchScope,
  });

  if (!profile) {
    throw new TenantProfileError(
      "TENANT_PROFILE_NOT_FOUND",
      "The current tenant user profile was not found.",
      404,
    );
  }

  return profile;
}

function toMutableFields(
  profile: TenantProfileRecord,
): TenantProfileMutableFields {
  return {
    displayName: profile.displayName,
    language: profile.language,
  };
}

async function attachPasswordPolicy(
  profile: TenantProfileRecord,
  db: Database,
): Promise<TenantProfile> {
  const policy = await resolveEffectiveSecurityPolicy(db);

  return {
    ...profile,
    passwordPolicy: {
      passwordMinLength: policy.passwordMinLength,
      passwordRequiresNumber: policy.passwordRequiresNumber,
      passwordRequiresSymbol: policy.passwordRequiresSymbol,
    },
  };
}

export async function getTenantSelfProfile(
  authContext: TenantProfileRequestInput<unknown>["authContext"],
  db: Database = getDb(),
): Promise<TenantProfile> {
  const tenantId = requireTenantId(authContext);
  await assertActiveTenant(authContext, db);

  const profile = await loadSelfProfile(db, { authContext, tenantId });
  return attachPasswordPolicy(profile, db);
}

export async function updateTenantSelfProfile(
  input: TenantProfileRequestInput<UpdateTenantProfileRequest>,
  db: Database = getDb(),
): Promise<TenantProfile> {
  const tenantId = requireTenantId(input.authContext);
  await assertActiveTenant(input.authContext, db);

  if (!Object.values(input.data).some((value) => value !== undefined)) {
    throw new TenantProfileError(
      "TENANT_PROFILE_UPDATE_EMPTY",
      "At least one profile field must be provided.",
      422,
    );
  }

  return db.transaction(async (tx) => {
    const before = await loadSelfProfile(tx, {
      authContext: input.authContext,
      tenantId,
    });
    const beforeFields = toMutableFields(before);
    const fields: TenantProfileMutableFields = {
      displayName: input.data.displayName ?? beforeFields.displayName,
      language: input.data.language ?? beforeFields.language,
    };

    await updateTenantSelfProfileRecord(tx, {
      userId: input.authContext.userId,
      fields,
    });

    const after = await loadSelfProfile(tx, {
      authContext: input.authContext,
      tenantId,
    });

    await writeTenantProfileUpdatedAuditLog(tx, {
      tenantId,
      actorUserId: input.authContext.userId,
      before: beforeFields,
      after: toMutableFields(after),
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return attachPasswordPolicy(after, tx);
  });
}

export async function changeTenantSelfPassword(
  input: TenantProfileRequestInput<ChangeTenantProfilePasswordRequest>,
  db: Database = getDb(),
): Promise<ChangeTenantProfilePasswordResult> {
  const tenantId = requireTenantId(input.authContext);
  await assertActiveTenant(input.authContext, db);

  const credential = await findTenantUserCredential(db, {
    tenantId,
    userId: input.authContext.userId,
  });
  if (!credential) {
    throw new TenantProfileError(
      "TENANT_PROFILE_NOT_FOUND",
      "The current tenant user profile was not found.",
      404,
    );
  }

  const currentPasswordValid = await verifyPassword(
    input.data.currentPassword,
    credential.passwordHash,
  );
  if (!currentPasswordValid) {
    throw new TenantProfileError(
      "CURRENT_PASSWORD_INCORRECT",
      "Current password is incorrect.",
      422,
    );
  }
  if (input.data.newPassword === input.data.currentPassword) {
    throw new TenantProfileError(
      "NEW_PASSWORD_UNCHANGED",
      "New password must be different from the current password.",
      422,
    );
  }

  const securityPolicy = await resolveEffectiveSecurityPolicy(db);
  const policyError = validatePasswordAgainstPolicy(
    input.data.newPassword,
    securityPolicy,
  );
  if (policyError) {
    throw new TenantProfileError(
      "PASSWORD_POLICY_VIOLATION",
      policyError,
      422,
    );
  }

  const passwordHash = await hashPassword(input.data.newPassword);

  return db.transaction(async (tx) => {
    const updated = await updateTenantUserPasswordRecord(tx, {
      tenantId,
      userId: input.authContext.userId,
      expectedPasswordHash: credential.passwordHash,
      passwordHash,
    });
    if (!updated) {
      throw new TenantProfileError(
        "TENANT_PROFILE_CONFLICT",
        "The account changed while the password was being updated. Try again.",
        409,
      );
    }

    const sessionsRevoked = await revokeTenantUserRefreshTokens(tx, {
      tenantId,
      userId: input.authContext.userId,
    });

    await writeTenantPasswordChangedAuditLog(tx, {
      tenantId,
      actorUserId: input.authContext.userId,
      sessionsRevoked,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return {
      passwordChanged: true,
      sessionsRevoked,
    };
  });
}
