import { getDb, type Database } from "@cleanhub/db";

import { AuthError } from "../../auth/auth.errors.js";
import type { AuthContext } from "../../auth/auth.types.js";
import { generateTemporaryPassword } from "../../auth/temporary-password.helper.js";
import { assertPasswordMeetsPolicy } from "../../auth/password-policy.helper.js";
import { hashPassword, hashPin } from "../../auth/password.service.js";
import { resolveEffectiveSecurityPolicy } from "../security/security-policy.js";
import { randomUUID } from "node:crypto";
import { requireSaasRole, type SaasRole } from "../../auth/permission.helper.js";
import { SaasUsersError } from "./saas-users.errors.js";
import {
  countActiveSaasSuperAdmins,
  createSaasUserRecord,
  findActiveSaasUserRoleCodes,
  findActiveSaasUserRoleRecords,
  findActiveSaasRolesByCodes,
  findActiveSaasRoleByCode,
  findOtherUserByNormalizedEmail,
  findOtherSaasUserByPhone,
  findSaasRoles,
  findSaasUserAuditSnapshotById,
  findSaasUserDetailById,
  findSaasUserStats,
  findUserByNormalizedEmail,
  findSaasUserByPhone,
  findSaasUsers,
  lockSaasUserForRoleUpdate,
  replaceSaasUserRolesRecord,
  resetSaasUserPasswordRecord,
  revokeSaasUserRefreshTokens,
  updateSaasUserRecord,
  updateSaasUserStatusRecord,
  writeSaasUserCreatedAuditLog,
  writeSaasUserPasswordResetAuditLog,
  writeSaasUserRolesUpdatedAuditLog,
  writeSaasUserStatusUpdatedAuditLog,
  writeSaasUserUpdatedAuditLog,
} from "./saas-users.repository.js";
import type {
  CreateSaasUserInput,
  GetSaasUserDetailInput,
  ListSaasUsersInput,
  ResetSaasUserPasswordInput,
  ResetSaasUserPasswordResult,
  SaasRoleListItem,
  SaasUserDetail,
  SaasUserListItem,
  SaasUserRoleCode,
  UpdateSaasUserInput,
  UpdateSaasUserRolesInput,
  UpdateSaasUserStatusInput,
} from "./saas-users.types.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string | undefined): string | undefined {
  const trimmed = phone?.trim();

  return trimmed ? trimmed : undefined;
}

function normalizeUpdatePhone(
  phone: string | null | undefined,
): string | null | undefined {
  if (phone === null) {
    return null;
  }

  return normalizePhone(phone);
}

function normalizeRoleCodes(
  roleCodes: SaasUserRoleCode[],
): SaasUserRoleCode[] {
  return [...new Set(roleCodes)].sort();
}

function areRoleCodesEqual(
  left: SaasUserRoleCode[],
  right: SaasUserRoleCode[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((roleCode, index) => roleCode === right[index]);
}

function requireSaasUsersAccess(
  authContext: AuthContext,
  allowedRoles: SaasRole[],
): void {
  requireSaasRole(authContext, allowedRoles);

  if (authContext.tenantId !== null) {
    throw new AuthError("FORBIDDEN", "Tenant users cannot access SaaS users.");
  }
}

export async function listSaasUsers(
  input: ListSaasUsersInput,
  db: Database = getDb(),
): Promise<SaasUserListItem[]> {
  requireSaasUsersAccess(input.authContext, ["super_admin", "support"]);

  return findSaasUsers(db, input.query);
}

export async function getSaasUserStats(
  input: { authContext: AuthContext; q?: string },
  db: Database = getDb(),
) {
  requireSaasUsersAccess(input.authContext, ["super_admin", "support"]);
  return findSaasUserStats(db, input.q);
}

export async function getSaasUserDetail(
  input: GetSaasUserDetailInput,
  db: Database = getDb(),
): Promise<SaasUserDetail> {
  requireSaasUsersAccess(input.authContext, ["super_admin", "support"]);

  const user = await findSaasUserDetailById(db, input.userId);

  if (!user) {
    throw new SaasUsersError(
      "SAAS_USER_NOT_FOUND",
      "SaaS user was not found.",
      404,
    );
  }

  return user;
}

export async function listSaasRoles(
  input: Pick<ListSaasUsersInput, "authContext">,
  db: Database = getDb(),
): Promise<SaasRoleListItem[]> {
  requireSaasUsersAccess(input.authContext, ["super_admin", "support"]);

  return findSaasRoles(db);
}

export async function createSaasUser(
  input: CreateSaasUserInput,
  db: Database = getDb(),
): Promise<SaasUserListItem> {
  requireSaasUsersAccess(input.authContext, ["super_admin"]);

  const normalizedEmail = normalizeEmail(input.data.email);
  const phone = normalizePhone(input.data.phone);
  const securityPolicy = await resolveEffectiveSecurityPolicy(db);

  assertPasswordMeetsPolicy(input.data.password, securityPolicy);

  const [passwordHash, pinHash] = await Promise.all([
    hashPassword(input.data.password),
    // SaaS platform users do not use POS PIN; store a non-guessable placeholder hash.
    hashPin(randomUUID()),
  ]);

  return db.transaction(async (tx) => {
    const existingUser = await findUserByNormalizedEmail(
      tx,
      normalizedEmail,
    );

    if (existingUser) {
      throw new SaasUsersError(
        "SAAS_USER_EMAIL_CONFLICT",
        "An account with this email already exists.",
        409,
      );
    }

    if (phone) {
      const existingPhoneUser = await findSaasUserByPhone(tx, phone);

      if (existingPhoneUser) {
        throw new SaasUsersError(
          "SAAS_USER_PHONE_CONFLICT",
          "A SaaS user with this phone already exists.",
          409,
        );
      }
    }

    const role = await findActiveSaasRoleByCode(tx, input.data.roleCode);

    if (!role) {
      throw new SaasUsersError(
        "SAAS_USER_ROLE_INVALID",
        "SaaS role is invalid or disabled.",
        422,
      );
    }

    const user = await createSaasUserRecord(tx, {
      actorUserId: input.authContext.userId,
      email: normalizedEmail,
      phone,
      normalizedEmail,
      displayName: input.data.displayName,
      passwordHash,
      pinHash,
      role,
      language: input.data.language,
    });

    await writeSaasUserCreatedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      user,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return user;
  });
}

export async function updateSaasUser(
  input: UpdateSaasUserInput,
  db: Database = getDb(),
): Promise<SaasUserDetail> {
  requireSaasUsersAccess(input.authContext, ["super_admin"]);

  if (!Object.values(input.data).some((value) => value !== undefined)) {
    throw new SaasUsersError(
      "SAAS_USER_UPDATE_EMPTY",
      "At least one SaaS user field must be provided.",
      422,
    );
  }

  const normalizedEmail =
    input.data.email !== undefined
      ? normalizeEmail(input.data.email)
      : undefined;
  const phone = normalizeUpdatePhone(input.data.phone);

  return db.transaction(async (tx) => {
    const before = await findSaasUserAuditSnapshotById(tx, input.userId);

    if (!before) {
      throw new SaasUsersError(
        "SAAS_USER_NOT_FOUND",
        "SaaS user was not found.",
        404,
      );
    }

    if (normalizedEmail !== undefined) {
      const existingUser = await findOtherUserByNormalizedEmail(
        tx,
        normalizedEmail,
        input.userId,
      );

      if (existingUser) {
        throw new SaasUsersError(
          "SAAS_USER_EMAIL_CONFLICT",
          "An account with this email already exists.",
          409,
        );
      }
    }

    if (phone) {
      const existingPhoneUser = await findOtherSaasUserByPhone(
        tx,
        phone,
        input.userId,
      );

      if (existingPhoneUser) {
        throw new SaasUsersError(
          "SAAS_USER_PHONE_CONFLICT",
          "A SaaS user with this phone already exists.",
          409,
        );
      }
    }

    const user = await updateSaasUserRecord(tx, {
      userId: input.userId,
      email: normalizedEmail,
      normalizedEmail,
      phone,
      displayName: input.data.displayName,
      language: input.data.language,
      timezone: input.data.timezone,
    });

    if (!user) {
      throw new SaasUsersError(
        "SAAS_USER_NOT_FOUND",
        "SaaS user was not found.",
        404,
      );
    }

    const after = await findSaasUserAuditSnapshotById(tx, input.userId);

    if (!after) {
      throw new SaasUsersError(
        "SAAS_USER_NOT_FOUND",
        "SaaS user was not found.",
        404,
      );
    }

    await writeSaasUserUpdatedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      userId: input.userId,
      before,
      after,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return user;
  });
}

export async function updateSaasUserStatus(
  input: UpdateSaasUserStatusInput,
  db: Database = getDb(),
): Promise<SaasUserDetail> {
  requireSaasUsersAccess(input.authContext, ["super_admin"]);

  return db.transaction(async (tx) => {
    const before = await findSaasUserAuditSnapshotById(tx, input.userId);

    if (!before) {
      throw new SaasUsersError(
        "SAAS_USER_NOT_FOUND",
        "SaaS user was not found.",
        404,
      );
    }

    if (
      input.data.status === "disabled" &&
      input.userId === input.authContext.userId
    ) {
      throw new SaasUsersError(
        "SAAS_USER_CANNOT_DISABLE_SELF",
        "Super admins cannot disable their own account.",
        422,
      );
    }

    const roleCodes = await findActiveSaasUserRoleCodes(tx, input.userId);

    if (
      input.data.status === "disabled" &&
      roleCodes.includes("super_admin")
    ) {
      const activeSuperAdminCount = await countActiveSaasSuperAdmins(tx);

      if (before.status === "active" && activeSuperAdminCount <= 1) {
        throw new SaasUsersError(
          "SAAS_USER_LAST_SUPER_ADMIN",
          "At least one active super admin must remain.",
          422,
        );
      }
    }

    const isStatusChanged = before.status !== input.data.status;
    const user = isStatusChanged
      ? await updateSaasUserStatusRecord(tx, {
          userId: input.userId,
          status: input.data.status,
        })
      : await findSaasUserDetailById(tx, input.userId);

    if (!user) {
      throw new SaasUsersError(
        "SAAS_USER_NOT_FOUND",
        "SaaS user was not found.",
        404,
      );
    }

    if (input.data.status === "disabled") {
      await revokeSaasUserRefreshTokens(tx, input.userId);
    }

    if (isStatusChanged || input.data.status === "disabled") {
      await writeSaasUserStatusUpdatedAuditLog(tx, {
        actorUserId: input.authContext.userId,
        userId: input.userId,
        before: {
          status: before.status,
        },
        after: {
          status: input.data.status,
        },
        reason: input.data.reason,
        ipAddress: input.requestMeta?.ipAddress,
        userAgent: input.requestMeta?.userAgent,
      });
    }

    return user;
  });
}

export async function resetSaasUserPassword(
  input: ResetSaasUserPasswordInput,
  db: Database = getDb(),
): Promise<ResetSaasUserPasswordResult> {
  requireSaasUsersAccess(input.authContext, ["super_admin"]);

  if (input.userId === input.authContext.userId) {
    throw new SaasUsersError(
      "SAAS_USER_CANNOT_RESET_OWN_PASSWORD",
      "Super admins cannot reset their own password from this console.",
      422,
    );
  }

  return db.transaction(async (tx) => {
    const existing = await findSaasUserDetailById(tx, input.userId);

    if (!existing) {
      throw new SaasUsersError(
        "SAAS_USER_NOT_FOUND",
        "SaaS user was not found.",
        404,
      );
    }

    const securityPolicy = await resolveEffectiveSecurityPolicy(tx);
    const temporaryPassword = generateTemporaryPassword();

    // The generated password is built to satisfy the policy, but assert it so a
    // future policy change (e.g. disallowed symbols) fails loudly instead of
    // silently producing an unusable credential.
    assertPasswordMeetsPolicy(temporaryPassword, securityPolicy);

    const passwordHash = await hashPassword(temporaryPassword);

    await resetSaasUserPasswordRecord(tx, {
      userId: input.userId,
      passwordHash,
    });

    // Invalidate existing sessions so the new password takes effect on next
    // sign-in, mirroring the disable-user flow.
    await revokeSaasUserRefreshTokens(tx, input.userId);

    await writeSaasUserPasswordResetAuditLog(tx, {
      actorUserId: input.authContext.userId,
      userId: input.userId,
      reason: input.reason,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return { temporaryPassword };
  });
}

export async function updateSaasUserRoles(
  input: UpdateSaasUserRolesInput,
  db: Database = getDb(),
): Promise<SaasUserDetail> {
  requireSaasUsersAccess(input.authContext, ["super_admin"]);

  const desiredRoleCodes = normalizeRoleCodes(input.data.roleCodes);

  return db.transaction(async (tx) => {
    const targetUser = await lockSaasUserForRoleUpdate(tx, input.userId);

    if (!targetUser) {
      throw new SaasUsersError(
        "SAAS_USER_NOT_FOUND",
        "SaaS user was not found.",
        404,
      );
    }

    const requestedRoles = await findActiveSaasRolesByCodes(
      tx,
      desiredRoleCodes,
    );
    const requestedRoleCodes = new Set(requestedRoles.map((role) => role.code));

    if (
      requestedRoles.length !== desiredRoleCodes.length ||
      !desiredRoleCodes.every((roleCode) => requestedRoleCodes.has(roleCode))
    ) {
      throw new SaasUsersError(
        "SAAS_USER_ROLES_INVALID",
        "One or more SaaS roles are invalid or disabled.",
        422,
      );
    }

    const currentRoles = await findActiveSaasUserRoleRecords(tx, input.userId);
    const currentRoleCodes = normalizeRoleCodes(
      currentRoles.map((role) => role.code),
    );
    const hasDuplicateCurrentRoleRecords =
      currentRoles.length !== currentRoleCodes.length;

    if (
      targetUser.status === "active" &&
      currentRoleCodes.includes("super_admin") &&
      !desiredRoleCodes.includes("super_admin")
    ) {
      const activeSuperAdminCount = await countActiveSaasSuperAdmins(tx);

      if (activeSuperAdminCount <= 1) {
        throw new SaasUsersError(
          "SAAS_USER_LAST_SUPER_ADMIN",
          "At least one active super admin must remain.",
          422,
        );
      }
    }

    if (
      !hasDuplicateCurrentRoleRecords &&
      areRoleCodesEqual(currentRoleCodes, desiredRoleCodes)
    ) {
      const user = await findSaasUserDetailById(tx, input.userId);

      if (!user) {
        throw new SaasUsersError(
          "SAAS_USER_NOT_FOUND",
          "SaaS user was not found.",
          404,
        );
      }

      return user;
    }

    const rolesByCode = new Map(
      requestedRoles.map((role) => [role.code, role]),
    );
    const user = await replaceSaasUserRolesRecord(tx, {
      actorUserId: input.authContext.userId,
      userId: input.userId,
      currentUserRoleIds: currentRoles.map((role) => role.userRoleId),
      roles: desiredRoleCodes.map((roleCode) => rolesByCode.get(roleCode)!),
    });

    if (!user) {
      throw new SaasUsersError(
        "SAAS_USER_NOT_FOUND",
        "SaaS user was not found.",
        404,
      );
    }

    await writeSaasUserRolesUpdatedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      userId: input.userId,
      beforeRoles: currentRoleCodes,
      afterRoles: desiredRoleCodes,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return user;
  });
}
