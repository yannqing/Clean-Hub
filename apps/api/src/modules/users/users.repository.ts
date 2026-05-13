import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

import {
  roles,
  userProfiles,
  userRoles,
  users,
  type Database,
} from "@cleanhub/db";

import type { UserListInput, UserListItem } from "./users.types.js";

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
