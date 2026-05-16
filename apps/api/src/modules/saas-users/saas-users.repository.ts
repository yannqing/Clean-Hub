import { and, asc, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

import {
  type Database,
  roles,
  userProfiles,
  userRoles,
  users,
} from "@cleanhub/db";

import type { ListSaasUsersQuery, SaasUserListItem } from "./saas-users.types.js";

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

export async function findSaasUsers(
  db: Database,
  query: ListSaasUsersQuery,
): Promise<SaasUserListItem[]> {
  const searchQuery = normalizeSearchQuery(query.q);
  const rows = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      phone: users.phone,
      displayName: userProfiles.displayName,
      language: userProfiles.language,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(users.userType, "saas"),
        isNull(users.tenantId),
        isNull(users.deletedAt),
        query.status ? eq(users.status, query.status) : undefined,
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
    .limit(query.limit)
    .offset(query.offset);

  const userIds = rows.map((row) => row.id);

  if (userIds.length === 0) {
    return [];
  }

  const roleRows = await db
    .select({
      userId: userRoles.userId,
      roleCode: roles.code,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        inArray(userRoles.userId, userIds),
        isNull(userRoles.tenantId),
        isNull(userRoles.branchId),
        isNull(userRoles.revokedAt),
        eq(roles.scope, "saas"),
        eq(roles.status, "active"),
        isNull(roles.tenantId),
        isNull(roles.deletedAt),
      ),
    )
    .orderBy(asc(roles.code));

  const rolesByUserId = new Map<string, string[]>();

  for (const roleRow of roleRows) {
    const userRoleCodes = rolesByUserId.get(roleRow.userId) ?? [];

    userRoleCodes.push(roleRow.roleCode);
    rolesByUserId.set(roleRow.userId, userRoleCodes);
  }

  return rows.map((row) => ({
    id: row.id,
    tenantId: null,
    email: row.email,
    phone: row.phone,
    displayName: resolveDisplayName(row),
    role: rolesByUserId.get(row.id)?.[0] ?? "unassigned",
    roles: rolesByUserId.get(row.id) ?? [],
    status: row.status,
    language: row.language ?? "en",
    lastLoginAt: toIsoString(row.lastLoginAt),
    createdAt: row.createdAt.toISOString(),
  }));
}
