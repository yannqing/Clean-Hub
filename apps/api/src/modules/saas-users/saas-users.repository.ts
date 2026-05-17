import { createId } from "@cleanhub/id";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
} from "drizzle-orm";

import {
  type Database,
  authRefreshTokens,
  permissions,
  rolePermissions,
  roles,
  userProfiles,
  userRoles,
  users,
} from "@cleanhub/db";

import { writeAuditLog } from "../audit/audit.helper.js";

import type {
  ListSaasUsersQuery,
  SaasRoleListItem,
  SaasUserDetail,
  SaasUserLanguage,
  SaasUserListItem,
  SaasUserStatus,
  SaasUserRoleCode,
} from "./saas-users.types.js";

export type SaasRoleRecord = {
  id: string;
  code: SaasUserRoleCode;
};

export type SaasUserRoleRecord = {
  userRoleId: string;
  roleId: string;
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

export type UpdateSaasUserRecordInput = {
  userId: string;
  email?: string;
  normalizedEmail?: string;
  phone?: string | null;
  displayName?: string;
  language?: SaasUserLanguage;
  timezone?: string;
};

export type SaasUserAuditSnapshot = {
  email: string | null;
  phone: string | null;
  displayName: string;
  status: string;
  language: string;
  timezone: string;
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

export async function findOtherSaasUserByNormalizedEmail(
  db: Database,
  normalizedEmail: string,
  userId: string,
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
        ne(users.id, userId),
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

export async function findOtherSaasUserByPhone(
  db: Database,
  phone: string,
  userId: string,
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
        ne(users.id, userId),
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

export async function findActiveSaasRolesByCodes(
  db: Database,
  roleCodes: SaasUserRoleCode[],
): Promise<SaasRoleRecord[]> {
  if (roleCodes.length === 0) {
    return [];
  }

  const roleRows = await db
    .select({
      id: roles.id,
      code: roles.code,
    })
    .from(roles)
    .where(
      and(
        eq(roles.scope, "saas"),
        isNull(roles.tenantId),
        inArray(roles.code, roleCodes),
        eq(roles.status, "active"),
        isNull(roles.deletedAt),
      ),
    );

  return roleRows.map((role) => ({
    id: role.id,
    code: role.code as SaasUserRoleCode,
  }));
}

export async function findSaasRoles(
  db: Database,
): Promise<SaasRoleListItem[]> {
  const roleRows = await db
    .select({
      id: roles.id,
      code: roles.code,
      name: roles.name,
      description: roles.description,
      status: roles.status,
      isSystem: roles.isSystem,
      permissionCode: permissions.code,
    })
    .from(roles)
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(
      and(
        eq(roles.scope, "saas"),
        isNull(roles.tenantId),
        isNull(roles.deletedAt),
      ),
    )
    .orderBy(
      desc(roles.isSystem),
      asc(roles.name),
      asc(roles.code),
      asc(permissions.code),
    );

  const rolesById = new Map<string, SaasRoleListItem>();

  for (const role of roleRows) {
    const roleItem = rolesById.get(role.id) ?? {
      id: role.id,
      code: role.code as SaasUserRoleCode,
      name: role.name,
      description: role.description,
      status: role.status,
      isSystem: role.isSystem,
      permissions: [],
    };

    if (
      role.permissionCode &&
      !roleItem.permissions.includes(role.permissionCode)
    ) {
      roleItem.permissions.push(role.permissionCode);
    }

    rolesById.set(role.id, roleItem);
  }

  return [...rolesById.values()];
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

export async function findSaasUserAuditSnapshotById(
  db: Database,
  userId: string,
): Promise<SaasUserAuditSnapshot | null> {
  const rows = await db
    .select({
      email: users.email,
      phone: users.phone,
      displayName: userProfiles.displayName,
      status: users.status,
      language: userProfiles.language,
      timezone: userProfiles.timezone,
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

  return {
    email: user.email,
    phone: user.phone,
    displayName: resolveDisplayName(user),
    status: user.status,
    language: user.language ?? "en",
    timezone: user.timezone ?? "UTC",
  };
}

export async function lockSaasUserForRoleUpdate(
  db: Database,
  userId: string,
): Promise<{ id: string; status: SaasUserStatus } | null> {
  const rows = await db
    .select({
      id: users.id,
      status: users.status,
    })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.userType, "saas"),
        isNull(users.tenantId),
        isNull(users.deletedAt),
      ),
    )
    .limit(1)
    .for("update");

  return rows[0] ?? null;
}

export async function findActiveSaasUserRoleCodes(
  db: Database,
  userId: string,
): Promise<SaasUserRoleCode[]> {
  const roleRows = await findActiveSaasUserRoleRecords(db, userId);

  return roleRows.map((row) => row.code);
}

export async function findActiveSaasUserRoleRecords(
  db: Database,
  userId: string,
): Promise<SaasUserRoleRecord[]> {
  const roleRows = await db
    .select({
      userRoleId: userRoles.id,
      roleId: roles.id,
      roleCode: roles.code,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        eq(userRoles.userId, userId),
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

  return roleRows.map((row) => ({
    userRoleId: row.userRoleId,
    roleId: row.roleId,
    code: row.roleCode as SaasUserRoleCode,
  }));
}

export async function countActiveSaasSuperAdmins(
  db: Database,
): Promise<number> {
  const rows = await db
    .select({
      userId: users.id,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        eq(users.userType, "saas"),
        isNull(users.tenantId),
        eq(users.status, "active"),
        isNull(users.deletedAt),
        isNull(userRoles.tenantId),
        isNull(userRoles.branchId),
        isNull(userRoles.revokedAt),
        eq(roles.scope, "saas"),
        isNull(roles.tenantId),
        eq(roles.code, "super_admin"),
        eq(roles.status, "active"),
        isNull(roles.deletedAt),
      ),
    );

  return new Set(rows.map((row) => row.userId)).size;
}

export async function updateSaasUserStatusRecord(
  db: Database,
  input: {
    userId: string;
    status: Extract<SaasUserListItem["status"], "active" | "disabled">;
  },
): Promise<SaasUserDetail | null> {
  await db
    .update(users)
    .set({
      status: input.status,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(users.id, input.userId),
        eq(users.userType, "saas"),
        isNull(users.tenantId),
        isNull(users.deletedAt),
      ),
    );

  return findSaasUserDetailById(db, input.userId);
}

export async function revokeSaasUserRefreshTokens(
  db: Database,
  userId: string,
): Promise<void> {
  await db
    .update(authRefreshTokens)
    .set({
      revokedAt: new Date(),
    })
    .where(
      and(
        eq(authRefreshTokens.userId, userId),
        isNull(authRefreshTokens.tenantId),
        isNull(authRefreshTokens.revokedAt),
      ),
    );
}

export async function writeSaasUserStatusUpdatedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    userId: string;
    before: Pick<SaasUserAuditSnapshot, "status">;
    after: Pick<SaasUserAuditSnapshot, "status">;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: null,
    actorUserId: input.actorUserId,
    eventCategory: "saas_user",
    eventType: "saas_user.status_updated",
    entityType: "user",
    entityId: input.userId,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    before: input.before,
    after: input.after,
  });
}

export async function replaceSaasUserRolesRecord(
  db: Database,
  input: {
    userId: string;
    actorUserId: string;
    currentUserRoleIds: string[];
    roles: SaasRoleRecord[];
  },
): Promise<SaasUserDetail | null> {
  const now = new Date();

  if (input.currentUserRoleIds.length > 0) {
    await db
      .update(userRoles)
      .set({
        revokedAt: now,
      })
      .where(inArray(userRoles.id, input.currentUserRoleIds));
  }

  if (input.roles.length > 0) {
    await db.insert(userRoles).values(
      input.roles.map((role) => ({
        id: createId(),
        userId: input.userId,
        roleId: role.id,
        tenantId: null,
        branchId: null,
        assignedBy: input.actorUserId,
      })),
    );
  }

  return findSaasUserDetailById(db, input.userId);
}

export async function writeSaasUserRolesUpdatedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    userId: string;
    beforeRoles: SaasUserRoleCode[];
    afterRoles: SaasUserRoleCode[];
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: null,
    actorUserId: input.actorUserId,
    eventCategory: "saas_user",
    eventType: "saas_user.roles_updated",
    entityType: "user",
    entityId: input.userId,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    before: {
      roles: input.beforeRoles,
    },
    after: {
      roles: input.afterRoles,
    },
  });
}

export async function updateSaasUserRecord(
  db: Database,
  input: UpdateSaasUserRecordInput,
): Promise<SaasUserDetail | null> {
  const now = new Date();
  const userUpdates: {
    updatedAt: Date;
    email?: string;
    normalizedEmail?: string;
    phone?: string | null;
  } = {
    updatedAt: now,
  };
  const profileUpdates: {
    updatedAt: Date;
    displayName?: string;
    language?: SaasUserLanguage;
    timezone?: string;
  } = {
    updatedAt: now,
  };
  let shouldUpdateProfile = false;

  if (input.email !== undefined && input.normalizedEmail !== undefined) {
    userUpdates.email = input.email;
    userUpdates.normalizedEmail = input.normalizedEmail;
  }

  if (input.phone !== undefined) {
    userUpdates.phone = input.phone;
  }

  if (input.displayName !== undefined) {
    profileUpdates.displayName = input.displayName;
    shouldUpdateProfile = true;
  }

  if (input.language !== undefined) {
    profileUpdates.language = input.language;
    shouldUpdateProfile = true;
  }

  if (input.timezone !== undefined) {
    profileUpdates.timezone = input.timezone;
    shouldUpdateProfile = true;
  }

  await db
    .update(users)
    .set(userUpdates)
    .where(
      and(
        eq(users.id, input.userId),
        eq(users.userType, "saas"),
        isNull(users.tenantId),
        isNull(users.deletedAt),
      ),
    );

  if (shouldUpdateProfile) {
    await db
      .update(userProfiles)
      .set(profileUpdates)
      .where(eq(userProfiles.userId, input.userId));
  }

  return findSaasUserDetailById(db, input.userId);
}

export async function writeSaasUserUpdatedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    userId: string;
    before: SaasUserAuditSnapshot;
    after: SaasUserAuditSnapshot;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: null,
    actorUserId: input.actorUserId,
    eventCategory: "saas_user",
    eventType: "saas_user.updated",
    entityType: "user",
    entityId: input.userId,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    before: input.before,
    after: input.after,
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
