import { getDb, type Database } from "@cleanhub/db";

import { hashPassword } from "../auth/password.service.js";
import {
  createSaasManagedUser,
  findAllSaasManagedUsers,
  findSaasManagedUserById,
  findUsers,
  softDeleteSaasManagedUser,
  updateSaasManagedUser,
  writeUserAuditLog,
} from "./users.repository.js";
import type {
  CreateSaasUserInput,
  SaasUserListInput,
  SaasUserListItem,
  SaasUserListResult,
  UpdateSaasUserInput,
  UserListInput,
  UserListItem,
} from "./users.types.js";

export async function listSaasUsers(
  input: Omit<UserListInput, "scope" | "tenantId">,
  db: Database = getDb(),
): Promise<UserListItem[]> {
  return findUsers(db, {
    ...input,
    scope: "saas",
  });
}

export async function listSaasManagedUsers(
  input: SaasUserListInput,
  db: Database = getDb(),
): Promise<SaasUserListResult> {
  return findAllSaasManagedUsers(db, input);
}

export async function createSaasUser(
  input: CreateSaasUserInput,
  options: {
    actorUserId?: string | null;
    db?: Database;
  } = {},
): Promise<SaasUserListItem> {
  const db = options.db ?? getDb();
  const created = await createSaasManagedUser(db, {
    ...input,
    passwordHash: await hashPassword(input.password),
  });

  await writeUserAuditLog(db, {
    actorUserId: options.actorUserId,
    tenantId: created.tenantId,
    eventType: "user.create",
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function updateSaasUser(
  userId: string,
  input: UpdateSaasUserInput,
  options: {
    actorUserId?: string | null;
    db?: Database;
  } = {},
): Promise<SaasUserListItem | null> {
  const db = options.db ?? getDb();
  const before = await findSaasManagedUserById(db, userId);
  const updated = await updateSaasManagedUser(db, userId, {
    ...input,
    passwordHash: input.password ? await hashPassword(input.password) : undefined,
  });

  if (!updated) {
    return null;
  }

  await writeUserAuditLog(db, {
    actorUserId: options.actorUserId,
    tenantId: updated.tenantId,
    eventType: "user.update",
    entityId: updated.id,
    before,
    after: updated,
  });

  return updated;
}

export async function deleteSaasUser(
  userId: string,
  options: {
    actorUserId?: string | null;
    db?: Database;
  } = {},
): Promise<SaasUserListItem | null> {
  const db = options.db ?? getDb();
  const deleted = await softDeleteSaasManagedUser(db, userId);

  if (!deleted) {
    return null;
  }

  await writeUserAuditLog(db, {
    actorUserId: options.actorUserId,
    tenantId: deleted.tenantId,
    eventType: "user.delete",
    entityId: deleted.id,
    before: deleted,
  });

  return deleted;
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
