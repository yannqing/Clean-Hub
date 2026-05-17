import { getDb, type Database } from "@cleanhub/db";

import { AuthError } from "../auth/auth.errors.js";
import type { AuthContext } from "../auth/auth.types.js";
import { hashPassword } from "../auth/password.service.js";
import { requireSaasRole, type SaasRole } from "../auth/permission.helper.js";
import { SaasUsersError } from "./saas-users.errors.js";
import {
  countActiveSaasSuperAdmins,
  createSaasUserRecord,
  findActiveSaasUserRoleCodes,
  findActiveSaasRoleByCode,
  findOtherSaasUserByNormalizedEmail,
  findOtherSaasUserByPhone,
  findSaasUserAuditSnapshotById,
  findSaasUserDetailById,
  findSaasUserByNormalizedEmail,
  findSaasUserByPhone,
  findSaasUsers,
  revokeSaasUserRefreshTokens,
  updateSaasUserRecord,
  updateSaasUserStatusRecord,
  writeSaasUserCreatedAuditLog,
  writeSaasUserStatusUpdatedAuditLog,
  writeSaasUserUpdatedAuditLog,
} from "./saas-users.repository.js";
import type {
  CreateSaasUserInput,
  GetSaasUserDetailInput,
  ListSaasUsersInput,
  SaasUserDetail,
  SaasUserListItem,
  UpdateSaasUserInput,
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

export async function createSaasUser(
  input: CreateSaasUserInput,
  db: Database = getDb(),
): Promise<SaasUserListItem> {
  requireSaasUsersAccess(input.authContext, ["super_admin"]);

  const normalizedEmail = normalizeEmail(input.data.email);
  const phone = normalizePhone(input.data.phone);
  const passwordHash = await hashPassword(input.data.password);

  return db.transaction(async (tx) => {
    const existingUser = await findSaasUserByNormalizedEmail(
      tx,
      normalizedEmail,
    );

    if (existingUser) {
      throw new SaasUsersError(
        "SAAS_USER_EMAIL_CONFLICT",
        "A SaaS user with this email already exists.",
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
      const existingUser = await findOtherSaasUserByNormalizedEmail(
        tx,
        normalizedEmail,
        input.userId,
      );

      if (existingUser) {
        throw new SaasUsersError(
          "SAAS_USER_EMAIL_CONFLICT",
          "A SaaS user with this email already exists.",
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
        400,
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
        ipAddress: input.requestMeta?.ipAddress,
        userAgent: input.requestMeta?.userAgent,
      });
    }

    return user;
  });
}
