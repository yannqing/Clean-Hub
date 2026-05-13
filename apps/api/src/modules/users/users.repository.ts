import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import {
  auditLogs,
  authRefreshTokens,
  roles,
  userProfiles,
  userRoles,
  users,
  type Database,
} from "@cleanhub/db";

import type {
  CreateSaasUserInput,
  SaasUserListInput,
  SaasUserListItem,
  SaasUserListResult,
  UpdateSaasUserInput,
  UserListInput,
  UserListItem,
} from "./users.types.js";

function normalizeSearchQuery(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? `%${trimmed}%` : undefined;
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function nullableTrim(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toSaasUserListItem(row: {
  id: string;
  tenantId: string | null;
  userType: "saas" | "tenant";
  email: string | null;
  phone: string | null;
  status: "invited" | "active" | "disabled" | "suspended";
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  displayName: string | null;
}): SaasUserListItem {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userType: row.userType,
    email: row.email,
    phone: row.phone,
    displayName: row.displayName ?? row.email ?? row.phone ?? "Unnamed user",
    status: row.status,
    lastLoginAt: toIsoString(row.lastLoginAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findUsers(
  db: Database,
  input: UserListInput,
): Promise<UserListItem[]> {
  const searchQuery = normalizeSearchQuery(input.q);
  const rows = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      phone: users.phone,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      displayName: userProfiles.displayName,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        isNull(users.deletedAt),
        eq(users.userType, input.scope),
        input.tenantId ? eq(users.tenantId, input.tenantId) : undefined,
        input.status ? eq(users.status, input.status) : undefined,
        searchQuery
          ? or(
              ilike(users.email, searchQuery),
              ilike(users.phone, searchQuery),
              ilike(userProfiles.displayName, searchQuery),
            )
          : undefined,
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  const userIds = rows.map((row) => row.id);

  if (userIds.length === 0) {
    return [];
  }

  const roleRows = await db
    .select({
      userId: userRoles.userId,
      branchId: userRoles.branchId,
      roleCode: roles.code,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(inArray(userRoles.userId, userIds), isNull(userRoles.revokedAt)));

  const accessByUserId = new Map<
    string,
    {
      roles: Set<string>;
      branchIds: Set<string>;
    }
  >();

  for (const roleRow of roleRows) {
    const access =
      accessByUserId.get(roleRow.userId) ??
      {
        roles: new Set<string>(),
        branchIds: new Set<string>(),
      };

    access.roles.add(roleRow.roleCode);

    if (roleRow.branchId) {
      access.branchIds.add(roleRow.branchId);
    }

    accessByUserId.set(roleRow.userId, access);
  }

  return rows.map((row) => {
    const access = accessByUserId.get(row.id);
    const userRoles = [...(access?.roles ?? [])];

    return {
      id: row.id,
      tenantId: row.tenantId,
      email: row.email,
      displayName: row.displayName ?? row.email ?? row.phone ?? "Unnamed user",
      role: userRoles[0] ?? "unassigned",
      roles: userRoles,
      branchIds: [...(access?.branchIds ?? [])],
      status: row.status,
      lastLoginAt: toIsoString(row.lastLoginAt),
      createdAt: row.createdAt.toISOString(),
    };
  });
}

export async function findAllSaasManagedUsers(
  db: Database,
  input: SaasUserListInput,
): Promise<SaasUserListResult> {
  const searchQuery = normalizeSearchQuery(input.q);
  const where = and(
    isNull(users.deletedAt),
    input.status ? eq(users.status, input.status) : undefined,
    searchQuery
      ? or(
          ilike(users.email, searchQuery),
          ilike(users.phone, searchQuery),
          ilike(userProfiles.displayName, searchQuery),
        )
      : undefined,
  );

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: users.id,
        tenantId: users.tenantId,
        userType: users.userType,
        email: users.email,
        phone: users.phone,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        displayName: userProfiles.displayName,
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(input.limit)
      .offset(input.offset),
    db.select({ total: count() }).from(users).leftJoin(
      userProfiles,
      eq(userProfiles.userId, users.id),
    ).where(where),
  ]);

  return {
    items: rows.map(toSaasUserListItem),
    total: totalRows[0]?.total ?? 0,
    limit: input.limit,
    offset: input.offset,
  };
}

export async function findSaasManagedUserById(
  db: Database,
  userId: string,
): Promise<SaasUserListItem | null> {
  const rows = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      userType: users.userType,
      email: users.email,
      phone: users.phone,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      displayName: userProfiles.displayName,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  return rows[0] ? toSaasUserListItem(rows[0]) : null;
}

export async function createSaasManagedUser(
  db: Database,
  input: CreateSaasUserInput & { passwordHash: string },
): Promise<SaasUserListItem> {
  const now = new Date();
  const rows = await db
    .insert(users)
    .values({
      tenantId: input.tenantId,
      userType: input.userType,
      email: nullableTrim(input.email),
      normalizedEmail: normalizeEmail(input.email),
      phone: nullableTrim(input.phone),
      passwordHash: input.passwordHash,
      status: input.status,
      updatedAt: now,
    })
    .returning({ id: users.id });

  const userId = rows[0]?.id;

  if (!userId) {
    throw new Error("Failed to create user.");
  }

  await db.insert(userProfiles).values({
    userId,
    displayName: input.displayName.trim(),
  });

  const created = await findSaasManagedUserById(db, userId);

  if (!created) {
    throw new Error("Created user could not be loaded.");
  }

  return created;
}

export async function updateSaasManagedUser(
  db: Database,
  userId: string,
  input: UpdateSaasUserInput & { passwordHash?: string },
): Promise<SaasUserListItem | null> {
  const before = await findSaasManagedUserById(db, userId);

  if (!before) {
    return null;
  }

  const userPatch: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date(),
    version: sql`${users.version} + 1` as unknown as number,
  };

  if ("tenantId" in input) {
    userPatch.tenantId = input.tenantId ?? null;
  }

  if (input.userType) {
    userPatch.userType = input.userType;
  }

  if ("email" in input) {
    userPatch.email = nullableTrim(input.email);
    userPatch.normalizedEmail = normalizeEmail(input.email);
  }

  if ("phone" in input) {
    userPatch.phone = nullableTrim(input.phone);
  }

  if (input.status) {
    userPatch.status = input.status;
  }

  if (input.passwordHash) {
    userPatch.passwordHash = input.passwordHash;
  }

  await db.update(users).set(userPatch).where(eq(users.id, userId));

  if (input.displayName) {
    await db
      .insert(userProfiles)
      .values({
        userId,
        displayName: input.displayName.trim(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          displayName: input.displayName.trim(),
          updatedAt: new Date(),
        },
      });
  }

  if (input.status === "disabled" || input.status === "suspended") {
    await revokeUserRefreshTokens(db, userId);
  }

  return findSaasManagedUserById(db, userId);
}

export async function softDeleteSaasManagedUser(
  db: Database,
  userId: string,
): Promise<SaasUserListItem | null> {
  const before = await findSaasManagedUserById(db, userId);

  if (!before) {
    return null;
  }

  await db
    .update(users)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      version: sql`${users.version} + 1` as unknown as number,
    })
    .where(eq(users.id, userId));

  await revokeUserRefreshTokens(db, userId);

  return before;
}

export async function revokeUserRefreshTokens(
  db: Database,
  userId: string,
): Promise<void> {
  await db
    .update(authRefreshTokens)
    .set({
      revokedAt: new Date(),
    })
    .where(and(eq(authRefreshTokens.userId, userId), isNull(authRefreshTokens.revokedAt)));
}

export async function writeUserAuditLog(
  db: Database,
  input: {
    actorUserId?: string | null;
    tenantId?: string | null;
    eventType: string;
    entityId?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  },
): Promise<void> {
  await db.insert(auditLogs).values({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "users",
    eventType: input.eventType,
    entityType: "user",
    entityId: input.entityId,
    before: input.before ?? undefined,
    after: input.after ?? undefined,
    success: true,
  });
}
