import { randomUUID } from "node:crypto";

import { getDb, type Database } from "@cleanhub/db";

import { writeAuditLog } from "../audit/audit.helper.js";
import { AuthError } from "../auth/auth.errors.js";
import { requireTenantRole } from "../auth/permission.helper.js";
import { hashPassword, hashPin } from "../auth/password.service.js";
import { UserError } from "./users.errors.js";
import {
  findActiveTenantRoleByCode,
  findTenantUserAuditSnapshot,
  findTenantUserById,
  findUsers,
  insertTenantUserRecord,
  revokeTenantUserRefreshTokens,
  softDeleteTenantUser,
  updateTenantUserPinHash,
  updateTenantUserRecord,
} from "./users.repository.js";
import type {
  CreateTenantOwnerUserInput,
  CreateTenantUserInput,
  DisableTenantUserInput,
  GetTenantUserInput,
  ResetTenantUserPinInput,
  ResetTenantUserPinResult,
  TenantUserDetail,
  UpdateTenantUserInput,
  UserListInput,
  UserListItem,
} from "./users.types.js";

function generateSixDigitPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function listSaasUsers(
  input: Omit<UserListInput, "scope" | "tenantId">,
  db: Database = getDb(),
): Promise<UserListItem[]> {
  return findUsers(db, {
    ...input,
    scope: "saas",
  });
}

export async function listTenantUsers(
  input: Omit<UserListInput, "scope"> & { tenantId: string },
  db: Database = getDb(),
): Promise<UserListItem[]> {
  return findUsers(db, {
    ...input,
    scope: "tenant",
  });
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
    throw new UserError("USER_NOT_FOUND", "Tenant user was not found.", 404);
  }

  return user;
}

export async function createTenantUser(
  input: CreateTenantUserInput,
  db: Database = getDb(),
): Promise<UserListItem> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  const tenantId = input.authContext.tenantId!;

  const [passwordHash, pinHash] = await Promise.all([
    // Tenant employees authenticate via PIN only; store a non-guessable placeholder hash.
    hashPassword(randomUUID()),
    hashPin(input.data.initialPin),
  ]);

  return db.transaction(async (tx) => {
    const role = await findActiveTenantRoleByCode(tx, input.data.roleCode);

    if (!role) {
      throw new UserError(
        "TENANT_USER_ROLE_INVALID",
        "Tenant role is invalid or disabled.",
        422,
      );
    }

    const user = await insertTenantUserRecord(tx, {
      tenantId,
      displayName: input.data.displayName,
      email: input.data.email,
      phone: input.data.phone,
      passwordHash,
      pinHash,
      role,
      branchIds: input.data.branchIds,
      actorUserId: input.authContext.userId,
    });

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      eventCategory: "tenant_user",
      eventType: "tenant_user.created",
      entityType: "user",
      entityId: user.id,
      after: {
        displayName: user.displayName,
        email: user.email,
        roles: user.roles,
        branchIds: user.branchIds,
        status: user.status,
      },
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
  requireTenantRole(input.authContext, ["owner", "manager"]);

  const tenantId = input.authContext.tenantId!;

  return db.transaction(async (tx) => {
    const before = await findTenantUserAuditSnapshot(
      tx,
      tenantId,
      input.userId,
    );

    if (!before) {
      throw new UserError("USER_NOT_FOUND", "Tenant user was not found.", 404);
    }

    await updateTenantUserRecord(tx, {
      userId: input.userId,
      tenantId,
      displayName: input.data.displayName,
      phone: input.data.phone,
      branchIds: input.data.branchIds,
    });

    const after = await findTenantUserAuditSnapshot(tx, tenantId, input.userId);

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      eventCategory: "tenant_user",
      eventType: "tenant_user.updated",
      entityType: "user",
      entityId: input.userId,
      before,
      after: after ?? undefined,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    const updated = await findTenantUserById(tx, tenantId, input.userId);

    return updated!;
  });
}

export async function disableTenantUser(
  input: DisableTenantUserInput,
  db: Database = getDb(),
): Promise<void> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  if (input.userId === input.authContext.userId) {
    throw new UserError(
      "CANNOT_DISABLE_SELF",
      "You cannot disable your own account.",
      409,
    );
  }

  const tenantId = input.authContext.tenantId!;

  return db.transaction(async (tx) => {
    const user = await findTenantUserById(tx, tenantId, input.userId);

    if (!user) {
      throw new UserError("USER_NOT_FOUND", "Tenant user was not found.", 404);
    }

    if (user.status === "disabled") {
      throw new UserError(
        "USER_ALREADY_DISABLED",
        "Tenant user is already disabled.",
        409,
      );
    }

    await softDeleteTenantUser(tx, input.userId);
    await revokeTenantUserRefreshTokens(tx, input.userId, tenantId);

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      eventCategory: "tenant_user",
      eventType: "tenant_user.disabled",
      entityType: "user",
      entityId: input.userId,
      before: { status: user.status },
      after: { status: "disabled" },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  });
}

export async function resetTenantUserPin(
  input: ResetTenantUserPinInput,
  db: Database = getDb(),
): Promise<ResetTenantUserPinResult> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  const tenantId = input.authContext.tenantId!;
  const user = await findTenantUserById(db, tenantId, input.userId);

  if (!user) {
    throw new UserError("USER_NOT_FOUND", "Tenant user was not found.", 404);
  }

  const temporaryPin = generateSixDigitPin();
  const newPinHash = await hashPin(temporaryPin);

  await db.transaction(async (tx) => {
    await updateTenantUserPinHash(tx, input.userId, newPinHash);

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      eventCategory: "tenant_user",
      eventType: "tenant_user.pin_reset",
      entityType: "user",
      entityId: input.userId,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  });

  return { temporaryPin };
}

export async function createTenantOwnerUser(
  db: Database,
  input: CreateTenantOwnerUserInput,
): Promise<UserListItem> {
  const [passwordHash, pinHash] = await Promise.all([
    hashPassword(randomUUID()),
    hashPin(input.initialPin),
  ]);

  return db.transaction(async (tx) => {
    const role = await findActiveTenantRoleByCode(tx, "owner");

    if (!role) {
      throw new AuthError(
        "FORBIDDEN",
        "Tenant owner role is not configured.",
      );
    }

    const user = await insertTenantUserRecord(tx, {
      tenantId: input.tenantId,
      displayName: input.displayName,
      email: input.email,
      phone: input.phone,
      passwordHash,
      pinHash,
      role,
      actorUserId: null,
    });

    await writeAuditLog(tx, {
      actorUserId: null,
      tenantId: input.tenantId,
      eventCategory: "tenant_user",
      eventType: "tenant_user.owner_created",
      entityType: "user",
      entityId: user.id,
      after: {
        displayName: user.displayName,
        email: user.email,
        roles: user.roles,
        status: user.status,
      },
    });

    return user;
  });
}
