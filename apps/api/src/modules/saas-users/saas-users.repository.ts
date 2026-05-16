import { createId } from "@cleanhub/id";
import { and, asc, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

import {
  type Database,
  roles,
  userProfiles,
  userRoles,
  users,
} from "@cleanhub/db";

import { writeAuditLog } from "../audit/audit.helper.js";

import type {
  ListSaasUsersQuery,
  SaasUserDetail,
  SaasUserLanguage,
  SaasUserListItem,
  SaasUserRoleCode,
} from "./saas-users.types.js";

export type SaasRoleRecord = {
  id: string;
  code: SaasUserRoleCode;
};

export type CreateSaasUserRecordInput = {
  actorUserId: string;
  email: string;
  phone?: string;
  normalizedEmail: string;
  displayName: string;
  passwordHash: string;
  role: SaasRoleRecord;
  language: SaasUserLanguage;
};

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

function getLatestDate(primary: Date, secondary: Date | null): Date {
  return secondary && secondary.getTime() > primary.getTime()
    ? secondary
    : primary;
}

export async function findSaasUserByNormalizedEmail(
  db: Database,
  normalizedEmail: string,
): Promise<{ id: string } | null> {
  const rows = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(
      and(
        eq(users.userType, "saas"),
        isNull(users.tenantId),
        eq(users.normalizedEmail, normalizedEmail),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findSaasUserByPhone(
  db: Database,
  phone: string,
): Promise<{ id: string } | null> {
  const rows = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(
      and(
        eq(users.userType, "saas"),
        isNull(users.tenantId),
        eq(users.phone, phone),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findActiveSaasRoleByCode(
  db: Database,
  roleCode: SaasUserRoleCode,
): Promise<SaasRoleRecord | null> {
  const rows = await db
    .select({
      id: roles.id,
      code: roles.code,
    })
    .from(roles)
    .where(
      and(
        eq(roles.scope, "saas"),
        isNull(roles.tenantId),
        eq(roles.code, roleCode),
        eq(roles.status, "active"),
        isNull(roles.deletedAt),
      ),
    )
    .limit(1);

  const role = rows[0];

  return role ? { id: role.id, code: role.code as SaasUserRoleCode } : null;
}

export async function createSaasUserRecord(
  db: Database,
  input: CreateSaasUserRecordInput,
): Promise<SaasUserListItem> {
  const userId = createId();
  const userRoleId = createId();
  const userRows = await db
    .insert(users)
    .values({
      id: userId,
      tenantId: null,
      userType: "saas",
      email: input.email,
      phone: input.phone,
      normalizedEmail: input.normalizedEmail,
      passwordHash: input.passwordHash,
      status: "active",
    })
    .returning({
      id: users.id,
      email: users.email,
      status: users.status,
      createdAt: users.createdAt,
    });
  const user = userRows[0];

  await db.insert(userProfiles).values({
    userId,
    displayName: input.displayName,
    language: input.language,
  });

  await db.insert(userRoles).values({
    id: userRoleId,
    userId,
    roleId: input.role.id,
    tenantId: null,
    branchId: null,
    assignedBy: input.actorUserId,
  });

  return {
    id: user.id,
    tenantId: null,
    email: user.email,
    phone: input.phone ?? null,
    displayName: input.displayName,
    role: input.role.code,
    roles: [input.role.code],
    status: user.status,
    language: input.language,
    lastLoginAt: null,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function writeSaasUserCreatedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    user: SaasUserListItem;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: null,
    actorUserId: input.actorUserId,
    eventCategory: "saas_user",
    eventType: "saas_user.created",
    entityType: "user",
    entityId: input.user.id,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    after: {
      id: input.user.id,
      email: input.user.email,
      phone: input.user.phone,
      displayName: input.user.displayName,
      status: input.user.status,
      roles: input.user.roles,
      language: input.user.language,
    },
  });
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

export async function findSaasUserDetailById(
  db: Database,
  userId: string,
): Promise<SaasUserDetail | null> {
  const rows = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      phone: users.phone,
      displayName: userProfiles.displayName,
      language: userProfiles.language,
      avatarUrl: userProfiles.avatarUrl,
      timezone: userProfiles.timezone,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      userUpdatedAt: users.updatedAt,
      profileUpdatedAt: userProfiles.updatedAt,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(users.id, userId),
        eq(users.userType, "saas"),
        isNull(users.tenantId),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  const user = rows[0];

  if (!user) {
    return null;
  }

  const roleRows = await db
    .select({
      roleCode: roles.code,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        eq(userRoles.userId, user.id),
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

  const userRolesList = roleRows.map((row) => row.roleCode);

  return {
    id: user.id,
    tenantId: null,
    email: user.email,
    phone: user.phone,
    displayName: resolveDisplayName(user),
    role: userRolesList[0] ?? "unassigned",
    roles: userRolesList,
    status: user.status,
    language: user.language ?? "en",
    avatarUrl: user.avatarUrl ?? null,
    timezone: user.timezone ?? "UTC",
    lastLoginAt: toIsoString(user.lastLoginAt),
    createdAt: user.createdAt.toISOString(),
    updatedAt: getLatestDate(
      user.userUpdatedAt,
      user.profileUpdatedAt,
    ).toISOString(),
  };
}
