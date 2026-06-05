import { randomBytes } from "node:crypto";

import { getDb, type Database } from "@cleanhub/db";

import { assertBranchIdsSubset } from "../auth/branch-scope.helper.js";
import { hashPassword, hashPin } from "../auth/password.service.js";
import { requireTenantRole } from "../auth/permission.helper.js";
import { TenantUserError } from "./tenant-users.errors.js";
import {
  countBranchesInTenant,
  disableTenantUserRecord,
  enableTenantUserRecord,
  findTenantUserAuditSnapshot,
  findTenantUserById,
  findTenantUserByNormalizedEmail,
  findTenantUsers,
  insertTenantUserRecord,
  resetTenantUserPinRecord,
  updateTenantUserRecord,
  writeTenantUserCreatedAuditLog,
  writeTenantUserPinResetAuditLog,
  writeTenantUserStatusChangedAuditLog,
  writeTenantUserUpdatedAuditLog,
} from "./tenant-users.repository.js";
import type {
  CreateTenantUserInput,
  DisableTenantUserInput,
  EnableTenantUserInput,
  GetTenantUserInput,
  ListTenantUsersInput,
  ResetTenantUserPinInput,
  ResetTenantUserPinResult,
  TenantUserDetail,
  TenantUserListItem,
  UpdateTenantUserInput,
} from "./tenant-users.types.js";

function generateTemporaryPin(): string {
  const num = randomBytes(4).readUInt32BE(0) % 1_000_000;

  return num.toString().padStart(6, "0");
}

async function assertBranchesExistInTenant(
  db: Database,
  tenantId: string,
  branchIds: string[],
): Promise<void> {
  if (branchIds.length === 0) return;

  const found = await countBranchesInTenant(db, tenantId, branchIds);

  if (found !== branchIds.length) {
    throw new TenantUserError(
      "TENANT_USER_BRANCH_UNAUTHORIZED",
      "One or more branch IDs do not exist in this tenant.",
      400,
    );
  }
}

export async function listTenantUsers(
  input: ListTenantUsersInput,
  db: Database = getDb(),
): Promise<TenantUserListItem[]> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  return findTenantUsers(db, input.authContext.tenantId!, input.query);
}

export async function getTenantUser(
  input: GetTenantUserInput,
  db: Database = getDb(),
): Promise<TenantUserDetail> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  const user = await findTenantUserById(
    db,
    input.authContext.tenantId!,
    input.userId,
  );

  if (!user) {
    throw new TenantUserError(
      "TENANT_USER_NOT_FOUND",
      "Tenant user was not found.",
      404,
    );
  }

  return user;
}

export async function createTenantUser(
  input: CreateTenantUserInput,
  db: Database = getDb(),
): Promise<TenantUserListItem> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  const tenantId = input.authContext.tenantId!;
  const branchIds = input.branchIds ?? [];

  await assertBranchIdsSubset(input.authContext, branchIds, db);
  await assertBranchesExistInTenant(db, tenantId, branchIds);

  if (input.email) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await findTenantUserByNormalizedEmail(
      db,
      tenantId,
      normalizedEmail,
    );

    if (existing) {
      throw new TenantUserError(
        "TENANT_USER_EMAIL_CONFLICT",
        "A user with this email already exists.",
        409,
      );
    }
  }

  const [passwordHash, pinHash] = await Promise.all([
    hashPassword(randomBytes(32).toString("base64url")),
    hashPin(input.initialPin),
  ]);

  const user = await insertTenantUserRecord(db, {
    actorUserId: input.authContext.userId,
    tenantId,
    displayName: input.displayName,
    email: input.email,
    phone: input.phone,
    roleCode: input.roleCode,
    branchIds,
    passwordHash,
    pinHash,
  });

  await writeTenantUserCreatedAuditLog(db, {
    actorUserId: input.authContext.userId,
    tenantId,
    user,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return user;
}

export async function updateTenantUser(
  input: UpdateTenantUserInput,
  db: Database = getDb(),
): Promise<TenantUserDetail> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  const tenantId = input.authContext.tenantId!;
  const existing = await findTenantUserById(db, tenantId, input.userId);

  if (!existing) {
    throw new TenantUserError(
      "TENANT_USER_NOT_FOUND",
      "Tenant user was not found.",
      404,
    );
  }

  if (input.branchIds !== undefined) {
    await assertBranchIdsSubset(input.authContext, input.branchIds, db);
    await assertBranchesExistInTenant(db, tenantId, input.branchIds);
  }

  const before = await findTenantUserAuditSnapshot(db, tenantId, input.userId);

  const updated = await updateTenantUserRecord(db, {
    userId: input.userId,
    tenantId,
    actorUserId: input.authContext.userId,
    displayName: input.displayName,
    phone: input.phone,
    branchIds: input.branchIds,
    roleCode: input.roleCode,
  });

  if (!updated) {
    throw new TenantUserError(
      "TENANT_USER_NOT_FOUND",
      "Tenant user was not found.",
      404,
    );
  }

  if (before) {
    const after = await findTenantUserAuditSnapshot(db, tenantId, input.userId);

    if (after) {
      await writeTenantUserUpdatedAuditLog(db, {
        actorUserId: input.authContext.userId,
        tenantId,
        userId: input.userId,
        before,
        after,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
    }
  }

  return updated;
}

export async function disableTenantUser(
  input: DisableTenantUserInput,
  db: Database = getDb(),
): Promise<void> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  const tenantId = input.authContext.tenantId!;

  if (input.userId === input.authContext.userId) {
    throw new TenantUserError(
      "TENANT_USER_SELF_DISABLE",
      "Cannot disable your own account.",
      400,
    );
  }

  const existing = await findTenantUserById(db, tenantId, input.userId);

  if (!existing) {
    throw new TenantUserError(
      "TENANT_USER_NOT_FOUND",
      "Tenant user was not found.",
      404,
    );
  }

  if (existing.status === "disabled") {
    throw new TenantUserError(
      "TENANT_USER_ALREADY_DISABLED",
      "Tenant user is already disabled.",
      409,
    );
  }

  const beforeStatus = existing.status;

  await disableTenantUserRecord(db, input.userId, tenantId);

  await writeTenantUserStatusChangedAuditLog(db, {
    actorUserId: input.authContext.userId,
    tenantId,
    userId: input.userId,
    beforeStatus,
    afterStatus: "disabled",
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}

export async function enableTenantUser(
  input: EnableTenantUserInput,
  db: Database = getDb(),
): Promise<void> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  const tenantId = input.authContext.tenantId!;
  const existing = await findTenantUserById(db, tenantId, input.userId);

  if (!existing) {
    throw new TenantUserError(
      "TENANT_USER_NOT_FOUND",
      "Tenant user was not found.",
      404,
    );
  }

  if (existing.status !== "disabled") {
    throw new TenantUserError(
      "TENANT_USER_NOT_DISABLED",
      "Tenant user is not disabled.",
      409,
    );
  }

  const beforeStatus = existing.status;

  await enableTenantUserRecord(db, input.userId, tenantId);

  await writeTenantUserStatusChangedAuditLog(db, {
    actorUserId: input.authContext.userId,
    tenantId,
    userId: input.userId,
    beforeStatus,
    afterStatus: "active",
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}

export async function resetTenantUserPin(
  input: ResetTenantUserPinInput,
  db: Database = getDb(),
): Promise<ResetTenantUserPinResult> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  const tenantId = input.authContext.tenantId!;
  const existing = await findTenantUserById(db, tenantId, input.userId);

  if (!existing) {
    throw new TenantUserError(
      "TENANT_USER_NOT_FOUND",
      "Tenant user was not found.",
      404,
    );
  }

  const temporaryPin = generateTemporaryPin();
  const pinHash = await hashPin(temporaryPin);

  await resetTenantUserPinRecord(db, input.userId, tenantId, pinHash);

  await writeTenantUserPinResetAuditLog(db, {
    actorUserId: input.authContext.userId,
    tenantId,
    userId: input.userId,
    reason: input.reason,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return { temporaryPin };
}
