import { randomBytes } from "node:crypto";

import { getDb, type Database } from "@cleanhub/db";

import {
  assertBranchIdsSubset,
  resolveAllowedBranchIds,
} from "../../auth/branch-scope.helper.js";
import { assertPasswordMeetsPolicy } from "../../auth/password-policy.helper.js";
import {
  hashPassword,
  hashPin,
  verifyPassword,
} from "../../auth/password.service.js";
import {
  assertActiveTenant,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import {
  lockPosTerminalsForBranchStatusChange,
  securityForceClosePosTerminalShifts,
} from "../../pos/terminal-lifecycle/terminal-lifecycle.repository.js";
import { resolveEffectiveSecurityPolicy } from "../../saas/security/security-policy.js";
import { TenantUserError } from "./tenant-users.errors.js";
import {
  countBranchesInTenant,
  findOtherUserByNormalizedEmail,
  findTenantPinCandidates,
  findTenantUserAuditSnapshot,
  findTenantUserById,
  findTenantUsers,
  findUserByNormalizedEmail,
  insertTenantUserRecord,
  lockTenantBranchPinAssignments,
  revokeTenantUserRefreshTokens,
  softDeleteTenantUserRecord,
  updateTenantUserPasswordRecord,
  updateTenantUserPinRecord,
  updateTenantUserRecord,
  updateTenantUserStatusRecord,
  writeTenantUserCreatedAuditLog,
  writeTenantUserCredentialResetAuditLog,
  writeTenantUserDeletedAuditLog,
  writeTenantUserStatusChangedAuditLog,
  writeTenantUserUpdatedAuditLog,
} from "./tenant-users.repository.js";
import type {
  CreateTenantUserInput,
  DeleteTenantUserInput,
  GetTenantUserInput,
  ListTenantUsersInput,
  ManagedTenantUserRoleCode,
  ResetTenantUserPasswordInput,
  ResetTenantUserPinInput,
  TenantUserDetail,
  TenantUserListItem,
  UpdateTenantUserInput,
  UpdateTenantUserStatusInput,
} from "./tenant-users.types.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function requireTenantUserManagementAccess(
  authContext: ListTenantUsersInput["authContext"],
  db: Database,
): Promise<{ tenantId: string; managerBranchId?: string }> {
  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);
  const tenantId = authContext.tenantId!;

  if (authContext.role === "owner") return { tenantId };

  const branchScope = await resolveAllowedBranchIds(authContext, db);
  if (branchScope === "all" || branchScope.length !== 1) {
    throw new TenantUserError(
      "TENANT_USER_BRANCH_UNAUTHORIZED",
      "Manager accounts must be assigned to exactly one branch.",
      403,
    );
  }
  return { tenantId, managerBranchId: branchScope[0]! };
}

async function assertBranchAssignment(
  db: Database,
  input: {
    authContext: CreateTenantUserInput["authContext"];
    tenantId: string;
    branchId: string;
  },
): Promise<void> {
  await assertBranchIdsSubset(input.authContext, [input.branchId], db);
  const branchCount = await countBranchesInTenant(db, input.tenantId, [input.branchId]);
  if (branchCount !== 1) {
    throw new TenantUserError(
      "TENANT_USER_BRANCH_UNAUTHORIZED",
      "The selected branch is unavailable in this tenant.",
      422,
    );
  }
}

function assertActorMayAssignRole(
  actorRole: "owner" | "manager",
  roleCode: ManagedTenantUserRoleCode,
): void {
  if (actorRole === "manager" && roleCode !== "cashier") {
    throw new TenantUserError(
      "TENANT_USER_ROLE_FORBIDDEN",
      "Managers can only manage cashier accounts in their branch.",
      403,
    );
  }
}

function assertActorMayAccessTarget(
  input: {
    actorUserId: string;
    actorRole: "owner" | "manager";
    managerBranchId?: string;
    target: TenantUserDetail;
    mutation: boolean;
  },
): void {
  if (input.target.role === "owner" && input.mutation) {
    throw new TenantUserError(
      "TENANT_USER_OWNER_PROTECTED",
      "Owner accounts cannot be changed from employee management.",
      403,
    );
  }

  if (input.mutation && input.target.id === input.actorUserId) {
    throw new TenantUserError(
      "TENANT_USER_SELF_MANAGEMENT_FORBIDDEN",
      "Use personal account settings to change your own account.",
      403,
    );
  }

  if (input.actorRole === "manager") {
    const canAccessSelf = !input.mutation && input.target.id === input.actorUserId;
    const canAccessCashier =
      input.target.role === "cashier" &&
      Boolean(
        input.managerBranchId &&
          input.target.branchIds.includes(input.managerBranchId),
      );
    if (!canAccessSelf && !canAccessCashier) {
      throw new TenantUserError(
        "TENANT_USER_NOT_FOUND",
        "Tenant user was not found.",
        404,
      );
    }
  }
}

async function requireManagedTarget(
  db: Database,
  input: {
    authContext: GetTenantUserInput["authContext"];
    tenantId: string;
    managerBranchId?: string;
    userId: string;
    mutation: boolean;
  },
): Promise<TenantUserDetail> {
  const target = await findTenantUserById(db, input.tenantId, input.userId);
  if (!target) {
    throw new TenantUserError(
      "TENANT_USER_NOT_FOUND",
      "Tenant user was not found.",
      404,
    );
  }
  assertActorMayAccessTarget({
    actorUserId: input.authContext.userId,
    actorRole: input.authContext.role as "owner" | "manager",
    managerBranchId: input.managerBranchId,
    target,
    mutation: input.mutation,
  });
  return target;
}

async function revokeTenantUserPosActivity(
  db: Database,
  input: {
    actorUserId: string;
    branchIds: string[];
    reason: string;
    requestMeta?: { ipAddress?: string; userAgent?: string };
    tenantId: string;
    userId: string;
  },
): Promise<void> {
  const terminals: Awaited<
    ReturnType<typeof lockPosTerminalsForBranchStatusChange>
  > = [];
  for (const branchId of [...new Set(input.branchIds)].sort()) {
    terminals.push(
      ...(await lockPosTerminalsForBranchStatusChange(db, {
        tenantId: input.tenantId,
        branchId,
      })),
    );
  }
  await securityForceClosePosTerminalShifts(db, {
    tenantId: input.tenantId,
    terminalIds: terminals.map((terminal) => terminal.id),
    staffId: input.userId,
    actorUserId: input.actorUserId,
    reason: input.reason,
    metadata: { trigger: "tenant_user_access_revoked" },
    requestMeta: input.requestMeta,
  });
  await revokeTenantUserRefreshTokens(db, {
    tenantId: input.tenantId,
    userId: input.userId,
  });
}

async function assertEmailAvailable(
  db: Database,
  email: string,
  excludeUserId?: string,
): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const existing = excludeUserId
    ? await findOtherUserByNormalizedEmail(db, normalizedEmail, excludeUserId)
    : await findUserByNormalizedEmail(db, normalizedEmail);
  if (existing) {
    throw new TenantUserError(
      "TENANT_USER_EMAIL_CONFLICT",
      "An account with this email already exists.",
      409,
    );
  }
}

async function assertPinAvailable(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    pin: string;
    excludeUserId?: string;
  },
): Promise<void> {
  const candidates = await findTenantPinCandidates(db, input);
  for (const candidate of candidates) {
    if (await verifyPassword(input.pin, candidate.pinHash)) {
      throw new TenantUserError(
        "TENANT_USER_PIN_CONFLICT",
        "This PIN is already used by another employee in the branch.",
        409,
      );
    }
  }
}

export async function listTenantUsers(
  input: ListTenantUsersInput,
  db: Database = getDb(),
): Promise<TenantUserListItem[]> {
  const access = await requireTenantUserManagementAccess(input.authContext, db);
  if (
    access.managerBranchId &&
    input.query.branchId &&
    input.query.branchId !== access.managerBranchId
  ) {
    throw new TenantUserError(
      "TENANT_USER_BRANCH_UNAUTHORIZED",
      "The selected branch is outside the manager's scope.",
      403,
    );
  }
  return findTenantUsers(db, {
    tenantId: access.tenantId,
    viewerUserId: input.authContext.userId,
    managerBranchId: access.managerBranchId,
    query: input.query,
  });
}

export async function getTenantUser(
  input: GetTenantUserInput,
  db: Database = getDb(),
): Promise<TenantUserDetail> {
  const access = await requireTenantUserManagementAccess(input.authContext, db);
  return requireManagedTarget(db, {
    authContext: input.authContext,
    ...access,
    userId: input.userId,
    mutation: false,
  });
}

export async function createTenantUser(
  input: CreateTenantUserInput,
  db: Database = getDb(),
): Promise<TenantUserListItem> {
  const access = await requireTenantUserManagementAccess(input.authContext, db);
  assertActorMayAssignRole(
    input.authContext.role as "owner" | "manager",
    input.data.roleCode,
  );
  await assertBranchAssignment(db, {
    authContext: input.authContext,
    tenantId: access.tenantId,
    branchId: input.data.branchId,
  });
  if (input.data.email) await assertEmailAvailable(db, input.data.email);
  await assertPinAvailable(db, {
    tenantId: access.tenantId,
    branchId: input.data.branchId,
    pin: input.data.pin,
  });

  const securityPolicy = await resolveEffectiveSecurityPolicy(db);
  if (input.data.password) {
    assertPasswordMeetsPolicy(input.data.password, securityPolicy);
  }
  const password = input.data.password ?? randomBytes(32).toString("base64url");
  const [passwordHash, pinHash] = await Promise.all([
    hashPassword(password),
    hashPin(input.data.pin),
  ]);

  return db.transaction(async (tx) => {
    await lockTenantBranchPinAssignments(tx, {
      tenantId: access.tenantId,
      branchId: input.data.branchId,
    });
    if (input.data.email) await assertEmailAvailable(tx, input.data.email);
    await assertPinAvailable(tx, {
      tenantId: access.tenantId,
      branchId: input.data.branchId,
      pin: input.data.pin,
    });
    const user = await insertTenantUserRecord(tx, {
      actorUserId: input.authContext.userId,
      tenantId: access.tenantId,
      displayName: input.data.displayName,
      email: input.data.email,
      phone: input.data.phone,
      roleCode: input.data.roleCode,
      branchId: input.data.branchId,
      passwordHash,
      pinHash,
      language: input.data.language,
    });
    await writeTenantUserCreatedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: access.tenantId,
      user,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    return user;
  });
}

export async function updateTenantUser(
  input: UpdateTenantUserInput,
  db: Database = getDb(),
): Promise<TenantUserDetail> {
  const access = await requireTenantUserManagementAccess(input.authContext, db);
  return db.transaction(async (tx) => {
    const existing = await requireManagedTarget(tx, {
      authContext: input.authContext,
      ...access,
      userId: input.userId,
      mutation: true,
    });
    const desiredRole = input.data.roleCode ?? existing.role;
    if (desiredRole !== "manager" && desiredRole !== "cashier") {
      throw new TenantUserError(
        "TENANT_USER_OWNER_PROTECTED",
        "Owner accounts cannot be changed from employee management.",
        403,
      );
    }
    assertActorMayAssignRole(
      input.authContext.role as "owner" | "manager",
      desiredRole,
    );
    const desiredBranchId = input.data.branchId ?? existing.branchIds[0];
    if (!desiredBranchId) {
      throw new TenantUserError(
        "TENANT_USER_BRANCH_UNAUTHORIZED",
        "Manager and cashier accounts require exactly one branch.",
        422,
      );
    }
    await assertBranchAssignment(tx, {
      authContext: input.authContext,
      tenantId: access.tenantId,
      branchId: desiredBranchId,
    });
    if (input.data.email) {
      await assertEmailAvailable(tx, input.data.email, input.userId);
    }
    if (desiredRole === "manager" && !(input.data.email ?? existing.email)) {
      throw new TenantUserError(
        "TENANT_USER_EMAIL_CONFLICT",
        "Manager accounts require an email address.",
        422,
      );
    }
    if (
      desiredRole === "manager" &&
      existing.role !== "manager" &&
      !input.data.password
    ) {
      throw new TenantUserError(
        "TENANT_USER_ROLE_FORBIDDEN",
        "Set a password when promoting an employee to manager.",
        422,
      );
    }

    let passwordHash: string | undefined;
    if (input.data.password) {
      const policy = await resolveEffectiveSecurityPolicy(tx);
      assertPasswordMeetsPolicy(input.data.password, policy);
      passwordHash = await hashPassword(input.data.password);
    }

    const before = await findTenantUserAuditSnapshot(tx, access.tenantId, input.userId);
    const accessChanged =
      desiredRole !== existing.role || desiredBranchId !== existing.branchIds[0];
    const updated = await updateTenantUserRecord(tx, {
      userId: input.userId,
      tenantId: access.tenantId,
      actorUserId: input.authContext.userId,
      displayName: input.data.displayName,
      email: input.data.email,
      phone: input.data.phone,
      roleCode: accessChanged ? desiredRole : undefined,
      branchId: accessChanged ? desiredBranchId : undefined,
      language: input.data.language,
      timezone: input.data.timezone,
    });
    if (!before || !updated) {
      throw new TenantUserError(
        "TENANT_USER_NOT_FOUND",
        "Tenant user was not found.",
        404,
      );
    }
    const after = await findTenantUserAuditSnapshot(tx, access.tenantId, input.userId);
    if (!after) {
      throw new TenantUserError(
        "TENANT_USER_NOT_FOUND",
        "Tenant user was not found.",
        404,
      );
    }
    if (passwordHash) {
      await updateTenantUserPasswordRecord(tx, {
        tenantId: access.tenantId,
        userId: input.userId,
        passwordHash,
      });
    }
    if (accessChanged || passwordHash) {
      await revokeTenantUserRefreshTokens(tx, {
        tenantId: access.tenantId,
        userId: input.userId,
      });
    }
    await writeTenantUserUpdatedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: access.tenantId,
      userId: input.userId,
      before,
      after,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    return updated;
  });
}

export async function updateTenantUserStatus(
  input: UpdateTenantUserStatusInput,
  db: Database = getDb(),
): Promise<TenantUserDetail> {
  const access = await requireTenantUserManagementAccess(input.authContext, db);
  return db.transaction(async (tx) => {
    const existing = await requireManagedTarget(tx, {
      authContext: input.authContext,
      ...access,
      userId: input.userId,
      mutation: true,
    });
    if (input.data.status === "disabled") {
      await revokeTenantUserPosActivity(tx, {
        actorUserId: input.authContext.userId,
        branchIds: existing.branchIds,
        reason: input.data.reason,
        requestMeta: input.requestMeta,
        tenantId: access.tenantId,
        userId: input.userId,
      });
    }
    if (existing.status === input.data.status) return existing;
    const updated = await updateTenantUserStatusRecord(tx, {
      tenantId: access.tenantId,
      userId: input.userId,
      status: input.data.status,
    });
    if (!updated) {
      throw new TenantUserError(
        "TENANT_USER_NOT_FOUND",
        "Tenant user was not found.",
        404,
      );
    }
    await writeTenantUserStatusChangedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: access.tenantId,
      userId: input.userId,
      branchId: existing.branchIds[0],
      beforeStatus: existing.status,
      afterStatus: input.data.status,
      reason: input.data.reason,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    return updated;
  });
}

export async function deleteTenantUser(
  input: DeleteTenantUserInput,
  db: Database = getDb(),
): Promise<void> {
  const access = await requireTenantUserManagementAccess(input.authContext, db);
  await db.transaction(async (tx) => {
    const existing = await requireManagedTarget(tx, {
      authContext: input.authContext,
      ...access,
      userId: input.userId,
      mutation: true,
    });
    await revokeTenantUserPosActivity(tx, {
      actorUserId: input.authContext.userId,
      branchIds: existing.branchIds,
      reason: input.data.reason,
      requestMeta: input.requestMeta,
      tenantId: access.tenantId,
      userId: input.userId,
    });
    const before = await findTenantUserAuditSnapshot(
      tx,
      access.tenantId,
      input.userId,
    );
    if (!before) {
      throw new TenantUserError(
        "TENANT_USER_NOT_FOUND",
        "Tenant user was not found.",
        404,
      );
    }

    const deleted = await softDeleteTenantUserRecord(tx, {
      tenantId: access.tenantId,
      userId: input.userId,
    });
    if (!deleted) {
      throw new TenantUserError(
        "TENANT_USER_NOT_FOUND",
        "Tenant user was not found.",
        404,
      );
    }
    await writeTenantUserDeletedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: access.tenantId,
      userId: input.userId,
      before,
      reason: input.data.reason,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  });
}

export async function resetTenantUserPin(
  input: ResetTenantUserPinInput,
  db: Database = getDb(),
): Promise<void> {
  const access = await requireTenantUserManagementAccess(input.authContext, db);
  await db.transaction(async (tx) => {
    const existing = await requireManagedTarget(tx, {
      authContext: input.authContext,
      ...access,
      userId: input.userId,
      mutation: true,
    });
    const branchId = existing.branchIds[0];
    if (!branchId) {
      throw new TenantUserError(
        "TENANT_USER_BRANCH_UNAUTHORIZED",
        "The employee does not have a branch assignment.",
        422,
      );
    }
    await lockTenantBranchPinAssignments(tx, {
      tenantId: access.tenantId,
      branchId,
    });
    await assertPinAvailable(tx, {
      tenantId: access.tenantId,
      branchId,
      pin: input.data.pin,
      excludeUserId: input.userId,
    });
    await updateTenantUserPinRecord(tx, {
      tenantId: access.tenantId,
      userId: input.userId,
      pinHash: await hashPin(input.data.pin),
    });
    await revokeTenantUserRefreshTokens(tx, {
      tenantId: access.tenantId,
      userId: input.userId,
    });
    await writeTenantUserCredentialResetAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: access.tenantId,
      userId: input.userId,
      branchId,
      credential: "pin",
      reason: input.data.reason,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  });
}

export async function resetTenantUserPassword(
  input: ResetTenantUserPasswordInput,
  db: Database = getDb(),
): Promise<void> {
  const access = await requireTenantUserManagementAccess(input.authContext, db);
  const policy = await resolveEffectiveSecurityPolicy(db);
  assertPasswordMeetsPolicy(input.data.password, policy);
  const passwordHash = await hashPassword(input.data.password);
  await db.transaction(async (tx) => {
    const existing = await requireManagedTarget(tx, {
      authContext: input.authContext,
      ...access,
      userId: input.userId,
      mutation: true,
    });
    await updateTenantUserPasswordRecord(tx, {
      tenantId: access.tenantId,
      userId: input.userId,
      passwordHash,
    });
    await revokeTenantUserRefreshTokens(tx, {
      tenantId: access.tenantId,
      userId: input.userId,
    });
    await writeTenantUserCredentialResetAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: access.tenantId,
      userId: input.userId,
      branchId: existing.branchIds[0],
      credential: "password",
      reason: input.data.reason,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  });
}
