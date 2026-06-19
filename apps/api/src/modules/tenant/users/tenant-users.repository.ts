import { createId } from "@cleanhub/id";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
} from "drizzle-orm";

import {
  authRefreshTokens,
  branches,
  roles,
  type Database,
  userBranches,
  userProfiles,
  userRoles,
  users,
} from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import type {
  ListTenantUsersQuery,
  TenantUserAuditSnapshot,
  TenantUserDetail,
  TenantUserListItem,
  TenantUserRoleCode,
  TenantUserStatus,
} from "./tenant-users.types.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function resolveDisplayName(row: {
  displayName: string | null;
  email: string | null;
  phone: string | null;
}): string {
  return row.displayName ?? row.email ?? row.phone ?? "Unnamed user";
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function getLatestDate(primary: Date, secondary: Date | null): Date {
  return secondary && secondary.getTime() > primary.getTime()
    ? secondary
    : primary;
}

function normalizeSearchQuery(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? `%${trimmed}%` : undefined;
}

const ROLE_CODE_TO_NAME: Record<TenantUserRoleCode, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
};

async function findActiveTenantRoleByCode(
  db: Database,
  tenantId: string,
  code: TenantUserRoleCode,
): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: roles.id })
    .from(roles)
    .where(
      and(
        eq(roles.tenantId, tenantId),
        eq(roles.scope, "tenant"),
        eq(roles.code, code),
        eq(roles.status, "active"),
        isNull(roles.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

async function ensureTenantRole(
  db: Database,
  tenantId: string,
  code: TenantUserRoleCode,
): Promise<string> {
  const existing = await findActiveTenantRoleByCode(db, tenantId, code);

  if (existing) {
    return existing.id;
  }

  const roleId = createId();

  await db.insert(roles).values({
    id: roleId,
    tenantId,
    scope: "tenant",
    code,
    name: ROLE_CODE_TO_NAME[code],
    status: "active",
    isSystem: true,
  });

  return roleId;
}

async function findTenantUserBranchIds(
  db: Database,
  userId: string,
  tenantId: string,
): Promise<string[]> {
  const rows = await db
    .select({ branchId: userBranches.branchId })
    .from(userBranches)
    .where(
      and(
        eq(userBranches.userId, userId),
        eq(userBranches.tenantId, tenantId),
      ),
    );

  return rows.map((row) => row.branchId);
}

async function replaceTenantUserBranches(
  db: Database,
  userId: string,
  tenantId: string,
  branchIds: string[],
): Promise<void> {
  await db
    .delete(userBranches)
    .where(
      and(
        eq(userBranches.userId, userId),
        eq(userBranches.tenantId, tenantId),
      ),
    );

  if (branchIds.length > 0) {
    await db.insert(userBranches).values(
      branchIds.map((branchId) => ({
        userId,
        branchId,
        tenantId,
      })),
    );
  }
}

async function replaceTenantUserRole(
  db: Database,
  userId: string,
  tenantId: string,
  actorUserId: string,
  roleCode: TenantUserRoleCode,
): Promise<void> {
  const now = new Date();
  const roleId = await ensureTenantRole(db, tenantId, roleCode);

  await db
    .update(userRoles)
    .set({ revokedAt: now })
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.tenantId, tenantId),
        isNull(userRoles.branchId),
        isNull(userRoles.revokedAt),
      ),
    );

  await db.insert(userRoles).values({
    id: createId(),
    userId,
    roleId,
    tenantId,
    branchId: null,
    assignedBy: actorUserId,
  });
}

export type CreateTenantUserRecordInput = {
  actorUserId: string;
  tenantId: string;
  displayName: string;
  email?: string;
  phone?: string;
  roleCode: TenantUserRoleCode;
  branchIds: string[];
  passwordHash: string;
  pinHash: string;
};

export type UpdateTenantUserRecordInput = {
  userId: string;
  tenantId: string;
  actorUserId: string;
  displayName?: string;
  phone?: string | null;
  branchIds?: string[];
  roleCode?: TenantUserRoleCode;
};

export async function countBranchesInTenant(
  db: Database,
  tenantId: string,
  branchIds: string[],
): Promise<number> {
  if (branchIds.length === 0) return 0;

  const rows = await db
    .select({ value: count() })
    .from(branches)
    .where(
      and(
        eq(branches.tenantId, tenantId),
        inArray(branches.id, branchIds),
        isNull(branches.deletedAt),
      ),
    );

  return rows[0]?.value ?? 0;
}

export async function findTenantUserByNormalizedEmail(
  db: Database,
  tenantId: string,
  normalizedEmail: string,
): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.tenantId, tenantId),
        eq(users.userType, "tenant"),
        eq(users.normalizedEmail, normalizedEmail),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findTenantUsers(
  db: Database,
  tenantId: string,
  query: ListTenantUsersQuery,
): Promise<TenantUserListItem[]> {
  const searchQuery = normalizeSearchQuery(query.q);

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      phone: users.phone,
      displayName: userProfiles.displayName,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(users.tenantId, tenantId),
        eq(users.userType, "tenant"),
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

  if (rows.length === 0) {
    return [];
  }

  const userIds = rows.map((row) => row.id);

  const [roleRows, branchRows] = await Promise.all([
    db
      .select({
        userId: userRoles.userId,
        roleCode: roles.code,
      })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          inArray(userRoles.userId, userIds),
          eq(userRoles.tenantId, tenantId),
          isNull(userRoles.branchId),
          isNull(userRoles.revokedAt),
          eq(roles.scope, "tenant"),
          eq(roles.status, "active"),
          eq(roles.tenantId, tenantId),
          isNull(roles.deletedAt),
        ),
      )
      .orderBy(asc(roles.code)),
    db
      .select({
        userId: userBranches.userId,
        branchId: userBranches.branchId,
      })
      .from(userBranches)
      .where(
        and(
          inArray(userBranches.userId, userIds),
          eq(userBranches.tenantId, tenantId),
        ),
      ),
  ]);

  const rolesByUserId = new Map<string, string[]>();

  for (const row of roleRows) {
    const codes = rolesByUserId.get(row.userId) ?? [];

    codes.push(row.roleCode);
    rolesByUserId.set(row.userId, codes);
  }

  const branchIdsByUserId = new Map<string, string[]>();

  for (const row of branchRows) {
    const ids = branchIdsByUserId.get(row.userId) ?? [];

    ids.push(row.branchId);
    branchIdsByUserId.set(row.userId, ids);
  }

  return rows.map((row) => ({
    id: row.id,
    tenantId,
    email: row.email,
    displayName: resolveDisplayName(row),
    role: rolesByUserId.get(row.id)?.[0] ?? "unassigned",
    roles: rolesByUserId.get(row.id) ?? [],
    branchIds: branchIdsByUserId.get(row.id) ?? [],
    status: row.status as TenantUserStatus,
    lastLoginAt: toIsoString(row.lastLoginAt),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function findTenantUserById(
  db: Database,
  tenantId: string,
  userId: string,
): Promise<TenantUserDetail | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      phone: users.phone,
      displayName: userProfiles.displayName,
      language: userProfiles.language,
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
        eq(users.tenantId, tenantId),
        eq(users.userType, "tenant"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  const user = rows[0];

  if (!user) {
    return null;
  }

  const [roleRows, branchIds] = await Promise.all([
    db
      .select({ roleCode: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.tenantId, tenantId),
          isNull(userRoles.branchId),
          isNull(userRoles.revokedAt),
          eq(roles.scope, "tenant"),
          eq(roles.status, "active"),
          eq(roles.tenantId, tenantId),
          isNull(roles.deletedAt),
        ),
      )
      .orderBy(asc(roles.code)),
    findTenantUserBranchIds(db, userId, tenantId),
  ]);

  const userRolesList = roleRows.map((row) => row.roleCode);

  return {
    id: user.id,
    tenantId,
    email: user.email,
    phone: user.phone,
    displayName: resolveDisplayName(user),
    role: userRolesList[0] ?? "unassigned",
    roles: userRolesList,
    branchIds,
    status: user.status as TenantUserStatus,
    language: user.language ?? "en",
    timezone: user.timezone ?? "UTC",
    lastLoginAt: toIsoString(user.lastLoginAt),
    createdAt: user.createdAt.toISOString(),
    updatedAt: getLatestDate(
      user.userUpdatedAt,
      user.profileUpdatedAt,
    ).toISOString(),
  };
}

export async function findTenantUserAuditSnapshot(
  db: Database,
  tenantId: string,
  userId: string,
): Promise<TenantUserAuditSnapshot | null> {
  const rows = await db
    .select({
      email: users.email,
      phone: users.phone,
      displayName: userProfiles.displayName,
      status: users.status,
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

  const user = rows[0];

  if (!user) {
    return null;
  }

  const branchIds = await findTenantUserBranchIds(db, userId, tenantId);

  return {
    email: user.email,
    phone: user.phone,
    displayName: resolveDisplayName(user),
    status: user.status,
    branchIds,
  };
}

export async function insertTenantUserRecord(
  db: Database,
  input: CreateTenantUserRecordInput,
): Promise<TenantUserListItem> {
  const userId = createId();
  const normalizedEmail = input.email ? normalizeEmail(input.email) : undefined;
  const roleId = await ensureTenantRole(db, input.tenantId, input.roleCode);

  const userRows = await db
    .insert(users)
    .values({
      id: userId,
      tenantId: input.tenantId,
      userType: "tenant",
      email: normalizedEmail,
      normalizedEmail,
      phone: input.phone,
      passwordHash: input.passwordHash,
      pinHash: input.pinHash,
      status: "active",
    })
    .returning({ id: users.id, createdAt: users.createdAt });

  const user = userRows[0]!;

  await db.insert(userProfiles).values({
    userId,
    displayName: input.displayName,
  });

  await db.insert(userRoles).values({
    id: createId(),
    userId,
    roleId,
    tenantId: input.tenantId,
    branchId: null,
    assignedBy: input.actorUserId,
  });

  if (input.branchIds.length > 0) {
    await db.insert(userBranches).values(
      input.branchIds.map((branchId) => ({
        userId,
        branchId,
        tenantId: input.tenantId,
      })),
    );
  }

  return {
    id: user.id,
    tenantId: input.tenantId,
    email: normalizedEmail ?? null,
    displayName: input.displayName,
    role: input.roleCode,
    roles: [input.roleCode],
    branchIds: input.branchIds,
    status: "active",
    lastLoginAt: null,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function updateTenantUserRecord(
  db: Database,
  input: UpdateTenantUserRecordInput,
): Promise<TenantUserDetail | null> {
  const now = new Date();

  if (input.phone !== undefined) {
    await db
      .update(users)
      .set({ phone: input.phone, updatedAt: now })
      .where(
        and(
          eq(users.id, input.userId),
          eq(users.tenantId, input.tenantId),
          eq(users.userType, "tenant"),
          isNull(users.deletedAt),
        ),
      );
  }

  if (input.displayName !== undefined) {
    await db
      .update(userProfiles)
      .set({ displayName: input.displayName, updatedAt: now })
      .where(eq(userProfiles.userId, input.userId));
  }

  if (input.branchIds !== undefined) {
    await replaceTenantUserBranches(
      db,
      input.userId,
      input.tenantId,
      input.branchIds,
    );
  }

  if (input.roleCode !== undefined) {
    await replaceTenantUserRole(
      db,
      input.userId,
      input.tenantId,
      input.actorUserId,
      input.roleCode,
    );
  }

  return findTenantUserById(db, input.tenantId, input.userId);
}

export async function disableTenantUserRecord(
  db: Database,
  userId: string,
  tenantId: string,
): Promise<void> {
  await db
    .update(users)
    .set({ status: "disabled", updatedAt: new Date() })
    .where(
      and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        eq(users.userType, "tenant"),
        isNull(users.deletedAt),
      ),
    );

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

export async function enableTenantUserRecord(
  db: Database,
  userId: string,
  tenantId: string,
): Promise<void> {
  await db
    .update(users)
    .set({ status: "active", updatedAt: new Date() })
    .where(
      and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        eq(users.userType, "tenant"),
        isNull(users.deletedAt),
      ),
    );
}

export async function resetTenantUserPinRecord(
  db: Database,
  userId: string,
  tenantId: string,
  pinHash: string,
): Promise<void> {
  await db
    .update(users)
    .set({ pinHash, updatedAt: new Date() })
    .where(
      and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        eq(users.userType, "tenant"),
        isNull(users.deletedAt),
      ),
    );
}

export async function writeTenantUserCreatedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    tenantId: string;
    user: TenantUserListItem;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "tenant_user",
    eventType: "user.created",
    entityType: "user",
    entityId: input.user.id,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    after: {
      id: input.user.id,
      email: input.user.email,
      displayName: input.user.displayName,
      role: input.user.role,
      branchIds: input.user.branchIds,
      status: input.user.status,
    },
  });
}

export async function writeTenantUserUpdatedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    tenantId: string;
    userId: string;
    before: TenantUserAuditSnapshot;
    after: TenantUserAuditSnapshot;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "tenant_user",
    eventType: "user.updated",
    entityType: "user",
    entityId: input.userId,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    before: input.before,
    after: input.after,
  });
}

export async function writeTenantUserStatusChangedAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    tenantId: string;
    userId: string;
    beforeStatus: string;
    afterStatus: string;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "tenant_user",
    eventType: "user.status_changed",
    entityType: "user",
    entityId: input.userId,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    before: { status: input.beforeStatus },
    after: { status: input.afterStatus },
  });
}

export async function writeTenantUserPinResetAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    tenantId: string;
    userId: string;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "tenant_user",
    eventType: "user.pin_reset",
    entityType: "user",
    entityId: input.userId,
    success: true,
    reason: input.reason,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}
