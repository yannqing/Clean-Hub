import { getDb, type Database } from "@cleanhub/db";

import { resolveAllowedBranchIds } from "../../auth/branch-scope.helper.js";
import { validatePasswordAgainstPolicy } from "../../auth/password-policy.helper.js";
import { hashPassword, hashPin, verifyPassword } from "../../auth/password.service.js";
import { isNormalizedEmailUniqueViolation } from "../../auth/email-identity.helper.js";
import {
  assertActiveTenant,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { resolveEffectiveSecurityPolicy } from "../../saas/security/security-policy.js";
import { hashOpaqueToken } from "../../auth/token.service.js";
import { TenantProfileError } from "./profile.errors.js";
import { lockTenantPinAssignments } from "../users/tenant-users.repository.js";
import {
  findOtherTenantPinHashes,
  findTenantLoginSessionFamilyIdByTokenHash,
  findTenantLoginSessionRecord,
  findTenantSelfProfile,
  findTenantUserCredential,
  listTenantLoginSessionRecords,
  revokeTenantLoginDeviceSessions,
  revokeTenantUserRefreshTokens,
  updateTenantSelfProfileRecord,
  updateTenantSelfPinRecord,
  updateTenantUserPasswordRecord,
  writeTenantLoginSessionRevokedAuditLog,
  writeTenantPasswordChangedAuditLog,
  writeTenantPinChangedAuditLog,
  writeTenantProfileUpdatedAuditLog,
} from "./profile.repository.js";
import type {
  ChangeTenantProfilePinRequest,
  ChangeTenantProfilePinResult,
  ChangeTenantProfilePasswordRequest,
  ChangeTenantProfilePasswordResult,
  RevokeTenantLoginSessionResult,
  TenantLoginSession,
  TenantProfile,
  TenantProfileMutableFields,
  TenantProfileRecord,
  TenantProfileRequestInput,
  UpdateTenantProfileRequest,
} from "./profile.types.js";

export async function changeTenantSelfPin(
  input: TenantProfileRequestInput<ChangeTenantProfilePinRequest>,
  db: Database = getDb(),
): Promise<ChangeTenantProfilePinResult> {
  const tenantId = requireTenantId(input.authContext);
  await assertActiveTenant(input.authContext, db);
  const credential = await findTenantUserCredential(db, {
    tenantId,
    userId: input.authContext.userId,
  });
  if (!credential) {
    throw new TenantProfileError("TENANT_PROFILE_NOT_FOUND", "The current tenant user profile was not found.", 404);
  }
  if (!(await verifyPassword(input.data.currentPin, credential.pinHash))) {
    throw new TenantProfileError("CURRENT_PIN_INCORRECT", "Current PIN is incorrect.", 422);
  }
  if (input.data.newPin === input.data.currentPin) {
    throw new TenantProfileError("NEW_PIN_UNCHANGED", "New PIN must differ from the current PIN.", 422);
  }

  return db.transaction(async (tx) => {
    await lockTenantPinAssignments(tx, tenantId);
    const otherHashes = await findOtherTenantPinHashes(tx, {
      tenantId,
      userId: input.authContext.userId,
    });
    for (const hash of otherHashes) {
      if (await verifyPassword(input.data.newPin, hash)) {
        throw new TenantProfileError("NEW_PIN_CONFLICT", "This PIN is already used by another tenant user.", 409);
      }
    }
    const updated = await updateTenantSelfPinRecord(tx, {
      tenantId,
      userId: input.authContext.userId,
      expectedPinHash: credential.pinHash,
      pinHash: await hashPin(input.data.newPin),
    });
    if (!updated) {
      throw new TenantProfileError("TENANT_PROFILE_CONFLICT", "The account changed while the PIN was being updated. Try again.", 409);
    }
    const sessionsRevoked = await revokeTenantUserRefreshTokens(tx, {
      tenantId,
      userId: input.authContext.userId,
    });
    await writeTenantPinChangedAuditLog(tx, {
      tenantId,
      actorUserId: input.authContext.userId,
      sessionsRevoked,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    return { pinChanged: true, sessionsRevoked };
  });
}

function toIsoString(value: Date): string {
  return new Date(value).toISOString();
}

async function resolveCurrentLoginSessionFamilyId(
  db: Database,
  input: { tenantId: string; userId: string; refreshToken?: string },
): Promise<string | null> {
  if (!input.refreshToken) {
    return null;
  }

  return findTenantLoginSessionFamilyIdByTokenHash(db, {
    tenantId: input.tenantId,
    userId: input.userId,
    tokenHash: hashOpaqueToken(input.refreshToken),
  });
}

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
    email: profile.email,
    phone: profile.phone,
    language: profile.language,
  };
}

function normalizeOptionalPhone(phone: string | null): string | null {
  return phone?.trim() || null;
}

function getLoginDeviceGroupKey(session: TenantLoginSession): string {
  if (session.deviceId) {
    return `device:${session.deviceId}`;
  }

  return "legacy:unknown";
}

function groupLoginSessionsByDevice(
  sessions: TenantLoginSession[],
): TenantLoginSession[] {
  const sortedSessions = [...sessions].sort((left, right) => {
    if (left.current !== right.current) {
      return left.current ? -1 : 1;
    }

    return right.lastActiveAt.localeCompare(left.lastActiveAt);
  });
  const devices = new Map<string, TenantLoginSession>();

  for (const session of sortedSessions) {
    const key = getLoginDeviceGroupKey(session);
    const existing = devices.get(key);

    if (!existing) {
      devices.set(key, { ...session });
      continue;
    }

    if (session.lastActiveAt > existing.lastActiveAt) {
      existing.lastActiveAt = session.lastActiveAt;
    }
    if (session.expiresAt > existing.expiresAt) {
      existing.expiresAt = session.expiresAt;
    }
  }

  return [...devices.values()].sort((left, right) => {
    if (left.current !== right.current) {
      return left.current ? -1 : 1;
    }

    return right.lastActiveAt.localeCompare(left.lastActiveAt);
  });
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

export async function getTenantLoginSessions(
  input: {
    authContext: TenantProfileRequestInput<unknown>["authContext"];
    requestMeta?: TenantProfileRequestInput<unknown>["requestMeta"];
    refreshToken?: string;
  },
  db: Database = getDb(),
): Promise<TenantLoginSession[]> {
  const tenantId = requireTenantId(input.authContext);
  await assertActiveTenant(input.authContext, db);

  const [sessions, currentFamilyId] = await Promise.all([
    listTenantLoginSessionRecords(db, {
      tenantId,
      userId: input.authContext.userId,
    }),
    resolveCurrentLoginSessionFamilyId(db, {
      tenantId,
      userId: input.authContext.userId,
      refreshToken: input.refreshToken,
    }),
  ]);

  return groupLoginSessionsByDevice(
    sessions.map((session) => {
      const current = session.id === currentFamilyId;

      return {
        id: session.id,
        deviceId: current
          ? (input.requestMeta?.deviceId ?? session.deviceId)
          : session.deviceId,
        userAgent: current
          ? (input.requestMeta?.userAgent ?? session.userAgent)
          : session.userAgent,
        ipAddress: current
          ? (input.requestMeta?.ipAddress ?? session.ipAddress)
          : session.ipAddress,
        signedInAt: toIsoString(session.signedInAt),
        lastActiveAt: toIsoString(session.lastActiveAt),
        expiresAt: toIsoString(session.expiresAt),
        current,
      };
    }),
  );
}

export async function revokeTenantLoginSession(
  input: {
    authContext: TenantProfileRequestInput<unknown>["authContext"];
    requestMeta?: TenantProfileRequestInput<unknown>["requestMeta"];
    refreshToken?: string;
    sessionId: string;
  },
  db: Database = getDb(),
): Promise<RevokeTenantLoginSessionResult> {
  const tenantId = requireTenantId(input.authContext);
  await assertActiveTenant(input.authContext, db);

  return db.transaction(async (tx) => {
    const [session, currentFamilyId] = await Promise.all([
      findTenantLoginSessionRecord(tx, {
        tenantId,
        userId: input.authContext.userId,
        sessionId: input.sessionId,
      }),
      resolveCurrentLoginSessionFamilyId(tx, {
        tenantId,
        userId: input.authContext.userId,
        refreshToken: input.refreshToken,
      }),
    ]);

    if (!session) {
      throw new TenantProfileError(
        "TENANT_LOGIN_SESSION_NOT_FOUND",
        "The login session was not found or is no longer active.",
        404,
      );
    }

    if (session.id === currentFamilyId) {
      throw new TenantProfileError(
        "TENANT_CURRENT_SESSION_REVOKE_FORBIDDEN",
        "The current login session cannot be revoked from this screen.",
        409,
      );
    }

    const revokedCount = await revokeTenantLoginDeviceSessions(tx, {
      tenantId,
      userId: input.authContext.userId,
      session,
      currentFamilyId,
    });

    if (revokedCount === 0) {
      throw new TenantProfileError(
        "TENANT_LOGIN_SESSION_NOT_FOUND",
        "The login session was not found or is no longer active.",
        404,
      );
    }

    await writeTenantLoginSessionRevokedAuditLog(tx, {
      tenantId,
      actorUserId: input.authContext.userId,
      sessionId: session.id,
      deviceId: session.deviceId,
      sessionsRevoked: revokedCount,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return { id: session.id, revoked: true, sessionsRevoked: revokedCount };
  });
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

  try {
    return await db.transaction(async (tx) => {
      const before = await loadSelfProfile(tx, {
        authContext: input.authContext,
        tenantId,
      });
      const beforeFields = toMutableFields(before);
      const fields: TenantProfileMutableFields = {
        displayName: input.data.displayName ?? beforeFields.displayName,
        email:
          input.data.email !== undefined
            ? input.data.email.trim().toLowerCase()
            : beforeFields.email,
        phone:
          input.data.phone !== undefined
            ? normalizeOptionalPhone(input.data.phone)
            : beforeFields.phone,
        language: input.data.language ?? beforeFields.language,
      };

      await updateTenantSelfProfileRecord(tx, {
        userId: input.authContext.userId,
        tenantId,
        fields,
        updateIdentity:
          input.data.email !== undefined || input.data.phone !== undefined,
        updateProfile:
          input.data.displayName !== undefined || input.data.language !== undefined,
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
  } catch (error) {
    if (isNormalizedEmailUniqueViolation(error)) {
      throw new TenantProfileError(
        "TENANT_PROFILE_EMAIL_CONFLICT",
        "An account with this email already exists.",
        409,
      );
    }

    throw error;
  }
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
