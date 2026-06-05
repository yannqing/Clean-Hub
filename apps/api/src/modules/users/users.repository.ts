import { createId } from "@cleanhub/id";
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
} from "drizzle-orm";

import {
  authRefreshTokens,
  roles,
  userBranches,
  userProfiles,
  userRoles,
  users,
  type Database,
} from "@cleanhub/db";

import type {
  TenantUserAuditSnapshot,
  TenantUserDetail,
  UserListInput,
  UserListItem,
} from "./users.types.js";

function resolveDisplayName(row: {
  displayName: string | null;
  email: string | null;
  phone: string | null;
}): string {
  return row.displayName ?? row.email ?? row.phone ?? "Unnamed user";
}

function normalizeSearchQuery(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? `%${trimmed}%` : undefined;
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
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
    { roles: Set<string>; branchIds: Set<string> }
  >();

  for (const roleRow of roleRows) {
    const access = accessByUserId.get(roleRow.userId) ?? {
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
    const userRolesList = [...(access?.roles ?? [])];

    return {
      id: row.id,
      tenantId: row.tenantId,
      email: row.email,
      displayName: resolveDisplayName(row),
      role: userRolesList[0] ?? "unassigned",
      roles: userRolesList,
      branchIds: [...(access?.branchIds ?? [])],
      status: row.status,
      lastLoginAt: toIsoString(row.lastLoginAt),
      createdAt: row.createdAt.toISOString(),
    };
  });
}

export async function findTenantUserById(
  db: Database,
  tenantId: string,
  userId: string,
): Promise<TenantUserDetail | null> {
  const rows = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      phone: users.phone,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      displayName: userProfiles.displayName,
      language: userProfiles.language,
      timezone: userProfiles.timezone,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        eq(users.userType, "tenant"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];

  if (!row) {
    return null;
  }

  const roleRows = await db
    .select({
      branchId: userRoles.branchId,
      roleCode: roles.code,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.userId, userId), isNull(userRoles.revokedAt)));

  const userRolesList = [...new Set(roleRows.map((r) => r.roleCode))];
  const branchIds = [
    ...new Set(
      roleRows
        .map((r) => r.branchId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    phone: row.phone,
    displayName: resolveDisplayName(row),
    role: userRolesList[0] ?? "unassigned",
    roles: userRolesList,
    branchIds,
    status: row.status,
    language: row.language ?? "en",
    timezone: row.timezone ?? "UTC",
    lastLoginAt: toIsoString(row.lastLoginAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findTenantUserAuditSnapshot(
  db: Database,
  tenantId: string,
  userId: string,
): Promise<TenantUserAuditSnapshot | null> {
  const rows = await db
    .select({
      displayName: userProfiles.displayName,
      phone: users.phone,
      status: users.status,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];

  if (!row) {
    return null;
  }

  const roleRows = await db
    .select({ roleCode: roles.code, branchId: userRoles.branchId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.userId, userId), isNull(userRoles.revokedAt)));

  return {
    displayName: row.displayName ?? "",
    phone: row.phone,
    status: row.status,
    roles: [...new Set(roleRows.map((r) => r.roleCode))],
    branchIds: [
      ...new Set(
        roleRows
          .map((r) => r.branchId)
          .filter((id): id is string => Boolean(id)),
      ),
    ],
  };
}

export type FindActiveTenantRoleResult = { id: string; code: string };

export async function findActiveTenantRoleByCode(
  db: Database,
  roleCode: string,
): Promise<FindActiveTenantRoleResult | null> {
  const rows = await db
    .select({ id: roles.id, code: roles.code })
    .from(roles)
    .where(
      and(
        eq(roles.scope, "tenant"),
        isNull(roles.tenantId),
        eq(roles.code, roleCode),
        eq(roles.status, "active"),
        isNull(roles.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export type InsertTenantUserInput = {
  tenantId: string;
  displayName: string;
  email?: string;
  phone?: string;
  passwordHash: string;
  pinHash: string;
  role: FindActiveTenantRoleResult;
  branchIds?: string[];
  actorUserId: string | null;
};

export async function insertTenantUserRecord(
  db: Database,
  input: InsertTenantUserInput,
): Promise<UserListItem> {
  const userId = createId();

  const normalizedEmail = input.email?.trim().toLowerCase();

  const userRows = await db
    .insert(users)
    .values({
      id: userId,
      tenantId: input.tenantId,
      userType: "tenant",
      email: input.email ?? null,
      normalizedEmail: normalizedEmail ?? null,
      phone: input.phone ?? null,
      passwordHash: input.passwordHash,
      pinHash: input.pinHash,
      status: "active",
    })
    .returning({
      id: users.id,
      email: users.email,
      status: users.status,
      createdAt: users.createdAt,
    });

  const user = userRows[0]!;

  await db.insert(userProfiles).values({
    userId,
    displayName: input.displayName,
  });

  if (input.branchIds && input.branchIds.length > 0) {
    await db.insert(userRoles).values(
      input.branchIds.map((branchId) => ({
        id: createId(),
        userId,
        roleId: input.role.id,
        tenantId: input.tenantId,
        branchId,
        assignedBy: input.actorUserId,
      })),
    );
  } else {
    await db.insert(userRoles).values({
      id: createId(),
      userId,
      roleId: input.role.id,
      tenantId: input.tenantId,
      branchId: null,
      assignedBy: input.actorUserId,
    });
  }

  return {
    id: user.id,
    tenantId: input.tenantId,
    email: user.email,
    displayName: input.displayName,
    role: input.role.code,
    roles: [input.role.code],
    branchIds: input.branchIds ?? [],
    status: user.status,
    lastLoginAt: null,
    createdAt: user.createdAt.toISOString(),
  };
}

export type UpdateTenantUserRecordInput = {
  userId: string;
  tenantId: string;
  displayName?: string;
  phone?: string | null;
  branchIds?: string[];
};

export async function updateTenantUserRecord(
  db: Database,
  input: UpdateTenantUserRecordInput,
): Promise<void> {
  if (input.displayName !== undefined) {
    await db
      .update(userProfiles)
      .set({ displayName: input.displayName, updatedAt: new Date() })
      .where(eq(userProfiles.userId, input.userId));
  }

  if (input.phone !== undefined) {
    await db
      .update(users)
      .set({ phone: input.phone, updatedAt: new Date() })
      .where(eq(users.id, input.userId));
  } else {
    await db
      .update(users)
      .set({ updatedAt: new Date() })
      .where(eq(users.id, input.userId));
  }

  if (input.branchIds !== undefined) {
    const current = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, input.userId),
          eq(userRoles.tenantId, input.tenantId),
          isNull(userRoles.revokedAt),
        ),
      )
      .limit(1);

    const roleId = current[0]?.roleId;

    if (roleId) {
      await db
        .delete(userRoles)
        .where(
          and(
            eq(userRoles.userId, input.userId),
            eq(userRoles.tenantId, input.tenantId),
            eq(userRoles.roleId, roleId),
          ),
        );

      if (input.branchIds.length > 0) {
        await db.insert(userRoles).values(
          input.branchIds.map((branchId) => ({
            id: createId(),
            userId: input.userId,
            roleId,
            tenantId: input.tenantId,
            branchId,
            assignedBy: null,
          })),
        );
      } else {
        await db.insert(userRoles).values({
          id: createId(),
          userId: input.userId,
          roleId,
          tenantId: input.tenantId,
          branchId: null,
          assignedBy: null,
        });
      }
    }
  }
}

export async function softDeleteTenantUser(
  db: Database,
  userId: string,
): Promise<void> {
  await db
    .update(users)
    .set({
      status: "disabled",
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function revokeTenantUserRefreshTokens(
  db: Database,
  userId: string,
  tenantId: string,
): Promise<void> {
  await db
    .update(authRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(authRefreshTokens.userId, userId),
        eq(authRefreshTokens.tenantId, tenantId),
        isNull(authRefreshTokens.revokedAt),
      ),
    );
}

export async function updateTenantUserPinHash(
  db: Database,
  userId: string,
  pinHash: string,
): Promise<void> {
  await db
    .update(users)
    .set({ pinHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
