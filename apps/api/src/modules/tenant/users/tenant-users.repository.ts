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
  ne,
  or,
  sql,
} from "drizzle-orm";

import { writeAuditLog } from "../../audit/audit.helper.js";
import { isNormalizedEmailUniqueViolation } from "../../auth/email-identity.helper.js";
import { TenantUserError } from "./tenant-users.errors.js";
import type {
  ListTenantUsersQuery,
  ManagedTenantUserRoleCode,
  TenantUserAuditSnapshot,
  TenantUserDetail,
  TenantUserListItem,
  TenantUserRoleCode,
  TenantUserStatus,
} from "./tenant-users.types.js";

const ROLE_CODE_TO_NAME: Record<TenantUserRoleCode, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
};

const ROLE_PRIORITY: Record<TenantUserRoleCode, number> = {
  owner: 3,
  manager: 2,
  cashier: 1,
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeSearchQuery(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? `%${trimmed}%` : undefined;
}

function resolveDisplayName(row: {
  displayName: string | null;
  email: string | null;
  phone: string | null;
}): string {
  return row.displayName ?? row.email ?? row.phone ?? "Unnamed user";
}

function toIsoString(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function getLatestDate(primary: Date, secondary: Date | null): Date {
  return secondary && secondary.getTime() > primary.getTime()
    ? secondary
    : primary;
}

function activeRoleCondition(tenantId: string) {
  return sql`exists (
    select 1
    from ${userRoles}
    inner join ${roles} on ${roles.id} = ${userRoles.roleId}
    where ${userRoles.userId} = ${users.id}
      and ${userRoles.tenantId} = ${tenantId}
      and ${userRoles.revokedAt} is null
      and ${roles.tenantId} = ${tenantId}
      and ${roles.scope} = 'tenant'
      and ${roles.status} = 'active'
      and ${roles.deletedAt} is null
  )`;
}

function roleFilterCondition(tenantId: string, roleCode: TenantUserRoleCode) {
  return sql`exists (
    select 1
    from ${userRoles}
    inner join ${roles} on ${roles.id} = ${userRoles.roleId}
    where ${userRoles.userId} = ${users.id}
      and ${userRoles.tenantId} = ${tenantId}
      and ${userRoles.revokedAt} is null
      and ${roles.tenantId} = ${tenantId}
      and ${roles.scope} = 'tenant'
      and ${roles.code} = ${roleCode}
      and ${roles.status} = 'active'
      and ${roles.deletedAt} is null
  )`;
}

function branchFilterCondition(tenantId: string, branchId: string) {
  return sql`(
    exists (
      select 1 from ${userBranches}
      where ${userBranches.userId} = ${users.id}
        and ${userBranches.tenantId} = ${tenantId}
        and ${userBranches.branchId} = ${branchId}
    )
    or exists (
      select 1 from ${userRoles}
      where ${userRoles.userId} = ${users.id}
        and ${userRoles.tenantId} = ${tenantId}
        and ${userRoles.branchId} = ${branchId}
        and ${userRoles.revokedAt} is null
    )
  )`;
}

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
  if (existing) return existing.id;

  await db.execute(
    sql`select pg_advisory_xact_lock(
      hashtextextended(${`tenant-role:${tenantId}:${code}`}, 0)
    )`,
  );
  const roleAfterLock = await findActiveTenantRoleByCode(db, tenantId, code);
  if (roleAfterLock) return roleAfterLock.id;

  const roleId = createId();
  await db.insert(roles).values({
    id: roleId,
    tenantId,
    scope: "tenant",
    code,
    name: ROLE_CODE_TO_NAME[code],
    description: `Tenant ${ROLE_CODE_TO_NAME[code].toLowerCase()} role.`,
    status: "active",
    isSystem: true,
  });
  return roleId;
}

async function findTenantUserRoleRecords(
  db: Database,
  tenantId: string,
  userIds: string[],
): Promise<
  Array<{ userId: string; roleCode: string; branchId: string | null }>
> {
  if (userIds.length === 0) return [];
  return db
    .select({
      userId: userRoles.userId,
      roleCode: roles.code,
      branchId: userRoles.branchId,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        inArray(userRoles.userId, userIds),
        eq(userRoles.tenantId, tenantId),
        isNull(userRoles.revokedAt),
        eq(roles.tenantId, tenantId),
        eq(roles.scope, "tenant"),
        inArray(roles.code, ["owner", "manager", "cashier"]),
        eq(roles.status, "active"),
        isNull(roles.deletedAt),
      ),
    )
    .orderBy(asc(roles.code));
}

async function findTenantUserBranchRows(
  db: Database,
  tenantId: string,
  userIds: string[],
): Promise<Array<{ userId: string; branchId: string }>> {
  if (userIds.length === 0) return [];
  return db
    .select({ userId: userBranches.userId, branchId: userBranches.branchId })
    .from(userBranches)
    .where(
      and(
        inArray(userBranches.userId, userIds),
        eq(userBranches.tenantId, tenantId),
      ),
    );
}

function aggregateAccess(
  roleRows: Array<{
    userId: string;
    roleCode: string;
    branchId: string | null;
  }>,
  branchRows: Array<{ userId: string; branchId: string }>,
) {
  const rolesByUserId = new Map<string, TenantUserRoleCode[]>();
  const branchesByUserId = new Map<string, Set<string>>();

  for (const row of roleRows) {
    const roleCode = row.roleCode as TenantUserRoleCode;
    const codes = rolesByUserId.get(row.userId) ?? [];
    if (!codes.includes(roleCode)) codes.push(roleCode);
    rolesByUserId.set(row.userId, codes);
    if (row.branchId) {
      const ids = branchesByUserId.get(row.userId) ?? new Set<string>();
      ids.add(row.branchId);
      branchesByUserId.set(row.userId, ids);
    }
  }

  for (const row of branchRows) {
    const ids = branchesByUserId.get(row.userId) ?? new Set<string>();
    ids.add(row.branchId);
    branchesByUserId.set(row.userId, ids);
  }

  for (const codes of rolesByUserId.values()) {
    codes.sort((left, right) => ROLE_PRIORITY[right] - ROLE_PRIORITY[left]);
  }

  return { rolesByUserId, branchesByUserId };
}

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
        eq(branches.status, "active"),
        isNull(branches.deletedAt),
      ),
    );
  return rows[0]?.value ?? 0;
}

export async function findUserByNormalizedEmail(
  db: Database,
  normalizedEmail: string,
): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.normalizedEmail, normalizedEmail))
    .limit(1);
  return rows[0] ?? null;
}

export async function findOtherUserByNormalizedEmail(
  db: Database,
  normalizedEmail: string,
  userId: string,
): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.normalizedEmail, normalizedEmail), ne(users.id, userId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function findTenantUsers(
  db: Database,
  input: {
    tenantId: string;
    viewerUserId: string;
    managerBranchId?: string;
    query: ListTenantUsersQuery;
  },
): Promise<TenantUserListItem[]> {
  const { tenantId, query } = input;
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
    .leftJoin(
      userProfiles,
      and(
        eq(userProfiles.userId, users.id),
        eq(userProfiles.tenantId, tenantId),
      ),
    )
    .where(
      and(
        eq(users.tenantId, tenantId),
        eq(users.userType, "tenant"),
        isNull(users.deletedAt),
        activeRoleCondition(tenantId),
        query.status ? eq(users.status, query.status) : undefined,
        query.roleCode
          ? roleFilterCondition(tenantId, query.roleCode)
          : undefined,
        query.branchId
          ? branchFilterCondition(tenantId, query.branchId)
          : undefined,
        input.managerBranchId
          ? or(
              eq(users.id, input.viewerUserId),
              and(
                roleFilterCondition(tenantId, "cashier"),
                branchFilterCondition(tenantId, input.managerBranchId),
              ),
            )
          : undefined,
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
  const [roleRows, branchRows] = await Promise.all([
    findTenantUserRoleRecords(db, tenantId, userIds),
    findTenantUserBranchRows(db, tenantId, userIds),
  ]);
  const { rolesByUserId, branchesByUserId } = aggregateAccess(
    roleRows,
    branchRows,
  );

  return rows.map((row) => {
    const userRoleCodes = rolesByUserId.get(row.id) ?? [];
    return {
      id: row.id,
      tenantId,
      email: row.email,
      phone: row.phone,
      displayName: resolveDisplayName(row),
      role: userRoleCodes[0] ?? "unassigned",
      roles: userRoleCodes,
      branchIds: [...(branchesByUserId.get(row.id) ?? [])],
      status: row.status as TenantUserStatus,
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
    .leftJoin(
      userProfiles,
      and(
        eq(userProfiles.userId, users.id),
        eq(userProfiles.tenantId, tenantId),
      ),
    )
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
  if (!user) return null;

  const [roleRows, branchRows] = await Promise.all([
    findTenantUserRoleRecords(db, tenantId, [userId]),
    findTenantUserBranchRows(db, tenantId, [userId]),
  ]);
  const { rolesByUserId, branchesByUserId } = aggregateAccess(
    roleRows,
    branchRows,
  );
  const userRoleCodes = rolesByUserId.get(user.id) ?? [];

  return {
    id: user.id,
    tenantId,
    email: user.email,
    phone: user.phone,
    displayName: resolveDisplayName(user),
    role: userRoleCodes[0] ?? "unassigned",
    roles: userRoleCodes,
    branchIds: [...(branchesByUserId.get(user.id) ?? [])],
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
  const user = await findTenantUserById(db, tenantId, userId);
  if (!user) return null;
  return {
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    branchIds: user.branchIds,
  };
}

export async function findTenantPinCandidates(
  db: Database,
  input: { tenantId: string; branchId: string; excludeUserId?: string },
): Promise<Array<{ id: string; pinHash: string }>> {
  return db
    .selectDistinct({ id: users.id, pinHash: users.pinHash })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        eq(users.tenantId, input.tenantId),
        eq(users.userType, "tenant"),
        isNull(users.deletedAt),
        input.excludeUserId ? ne(users.id, input.excludeUserId) : undefined,
        eq(userRoles.tenantId, input.tenantId),
        isNull(userRoles.revokedAt),
        eq(roles.tenantId, input.tenantId),
        eq(roles.scope, "tenant"),
        inArray(roles.code, ["owner", "manager", "cashier"]),
        eq(roles.status, "active"),
        isNull(roles.deletedAt),
        or(
          eq(roles.code, "owner"),
          eq(userRoles.branchId, input.branchId),
          sql`exists (
            select 1 from ${userBranches}
            where ${userBranches.userId} = ${users.id}
              and ${userBranches.tenantId} = ${input.tenantId}
              and ${userBranches.branchId} = ${input.branchId}
          )`,
        ),
      ),
    );
}

export async function lockTenantBranchPinAssignments(
  db: Database,
  input: { tenantId: string; branchId: string },
): Promise<void> {
  await lockTenantPinAssignments(db, input.tenantId);
  await db.execute(
    sql`select pg_advisory_xact_lock(
      hashtextextended(${`tenant-user-pin:${input.tenantId}:${input.branchId}`}, 0)
    )`,
  );
}

export async function lockTenantPinAssignments(db: Database, tenantId: string): Promise<void> {
  await db.execute(
    sql`select pg_advisory_xact_lock(
      hashtextextended(${`tenant-user-pin-all:${tenantId}`}, 0)
    )`,
  );
}

export type CreateTenantUserRecordInput = {
  actorUserId: string;
  tenantId: string;
  displayName: string;
  email?: string;
  phone?: string;
  roleCode: ManagedTenantUserRoleCode;
  branchId: string;
  passwordHash: string;
  pinHash: string;
  language: "en" | "fr" | "zh-CN";
};

export async function insertTenantUserRecord(
  db: Database,
  input: CreateTenantUserRecordInput,
): Promise<TenantUserListItem> {
  const userId = createId();
  const normalizedEmail = input.email ? normalizeEmail(input.email) : undefined;
  const roleId = await ensureTenantRole(db, input.tenantId, input.roleCode);

  let userRows: Array<{ id: string; createdAt: Date }>;
  try {
    userRows = await db
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
  } catch (error) {
    if (isNormalizedEmailUniqueViolation(error)) {
      throw new TenantUserError(
        "TENANT_USER_EMAIL_CONFLICT",
        "An account with this email already exists.",
        409,
      );
    }
    throw error;
  }

  await db.insert(userProfiles).values({
    userId,
    tenantId: input.tenantId,
    displayName: input.displayName,
    language: input.language,
  });
  await db.insert(userRoles).values({
    id: createId(),
    userId,
    roleId,
    tenantId: input.tenantId,
    branchId: input.branchId,
    assignedBy: input.actorUserId,
  });
  await db.insert(userBranches).values({
    userId,
    branchId: input.branchId,
    tenantId: input.tenantId,
  });

  return {
    id: userRows[0]!.id,
    tenantId: input.tenantId,
    email: normalizedEmail ?? null,
    phone: input.phone ?? null,
    displayName: input.displayName,
    role: input.roleCode,
    roles: [input.roleCode],
    branchIds: [input.branchId],
    status: "active",
    lastLoginAt: null,
    createdAt: userRows[0]!.createdAt.toISOString(),
  };
}

export async function updateTenantUserRecord(
  db: Database,
  input: {
    userId: string;
    tenantId: string;
    actorUserId: string;
    displayName?: string;
    email?: string;
    phone?: string | null;
    roleCode?: ManagedTenantUserRoleCode;
    branchId?: string;
    language?: "en" | "fr" | "zh-CN";
    timezone?: string;
  },
): Promise<TenantUserDetail | null> {
  const now = new Date();
  const userUpdates: {
    updatedAt: Date;
    email?: string;
    normalizedEmail?: string;
    phone?: string | null;
  } = { updatedAt: now };
  const profileUpdates: {
    updatedAt: Date;
    displayName?: string;
    language?: "en" | "fr" | "zh-CN";
    timezone?: string;
  } = { updatedAt: now };

  if (input.email !== undefined) {
    userUpdates.email = normalizeEmail(input.email);
    userUpdates.normalizedEmail = normalizeEmail(input.email);
  }
  if (input.phone !== undefined) userUpdates.phone = input.phone;
  if (input.displayName !== undefined)
    profileUpdates.displayName = input.displayName;
  if (input.language !== undefined) profileUpdates.language = input.language;
  if (input.timezone !== undefined) profileUpdates.timezone = input.timezone;

  try {
    if (input.email !== undefined || input.phone !== undefined) {
      await db
        .update(users)
        .set(userUpdates)
        .where(
          and(
            eq(users.id, input.userId),
            eq(users.tenantId, input.tenantId),
            eq(users.userType, "tenant"),
            isNull(users.deletedAt),
          ),
        );
    }
  } catch (error) {
    if (isNormalizedEmailUniqueViolation(error)) {
      throw new TenantUserError(
        "TENANT_USER_EMAIL_CONFLICT",
        "An account with this email already exists.",
        409,
      );
    }
    throw error;
  }

  if (
    input.displayName !== undefined ||
    input.language !== undefined ||
    input.timezone !== undefined
  ) {
    await db
      .update(userProfiles)
      .set(profileUpdates)
      .where(
        and(
          eq(userProfiles.userId, input.userId),
          eq(userProfiles.tenantId, input.tenantId),
        ),
      );
  }

  if (input.roleCode !== undefined && input.branchId !== undefined) {
    const roleId = await ensureTenantRole(db, input.tenantId, input.roleCode);
    await db
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, input.userId),
          eq(userRoles.tenantId, input.tenantId),
        ),
      );
    await db.insert(userRoles).values({
      id: createId(),
      userId: input.userId,
      roleId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      assignedBy: input.actorUserId,
    });
    await db
      .delete(userBranches)
      .where(
        and(
          eq(userBranches.userId, input.userId),
          eq(userBranches.tenantId, input.tenantId),
        ),
      );
    await db.insert(userBranches).values({
      userId: input.userId,
      branchId: input.branchId,
      tenantId: input.tenantId,
    });
  }

  return findTenantUserById(db, input.tenantId, input.userId);
}

export async function updateTenantUserStatusRecord(
  db: Database,
  input: { tenantId: string; userId: string; status: "active" | "disabled" },
): Promise<TenantUserDetail | null> {
  await db
    .update(users)
    .set({ status: input.status, updatedAt: new Date() })
    .where(
      and(
        eq(users.id, input.userId),
        eq(users.tenantId, input.tenantId),
        eq(users.userType, "tenant"),
        isNull(users.deletedAt),
      ),
    );
  return findTenantUserById(db, input.tenantId, input.userId);
}

export async function softDeleteTenantUserRecord(
  db: Database,
  input: { tenantId: string; userId: string },
): Promise<boolean> {
  const now = new Date();
  const deleted = await db
    .update(users)
    .set({
      email: null,
      normalizedEmail: null,
      phone: null,
      status: "disabled",
      deletedAt: now,
      updatedAt: now,
      version: sql`${users.version} + 1`,
    })
    .where(
      and(
        eq(users.id, input.userId),
        eq(users.tenantId, input.tenantId),
        eq(users.userType, "tenant"),
        isNull(users.deletedAt),
      ),
    )
    .returning({ id: users.id });

  if (!deleted[0]) return false;

  await db
    .update(userRoles)
    .set({ revokedAt: now })
    .where(
      and(
        eq(userRoles.userId, input.userId),
        eq(userRoles.tenantId, input.tenantId),
        isNull(userRoles.revokedAt),
      ),
    );
  await db
    .delete(userBranches)
    .where(
      and(
        eq(userBranches.userId, input.userId),
        eq(userBranches.tenantId, input.tenantId),
      ),
    );

  return true;
}

export async function updateTenantUserPinRecord(
  db: Database,
  input: { tenantId: string; userId: string; pinHash: string },
): Promise<void> {
  await db
    .update(users)
    .set({ pinHash: input.pinHash, updatedAt: new Date() })
    .where(
      and(
        eq(users.id, input.userId),
        eq(users.tenantId, input.tenantId),
        eq(users.userType, "tenant"),
        isNull(users.deletedAt),
      ),
    );
}

export async function updateTenantUserPasswordRecord(
  db: Database,
  input: { tenantId: string; userId: string; passwordHash: string },
): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash: input.passwordHash, updatedAt: new Date() })
    .where(
      and(
        eq(users.id, input.userId),
        eq(users.tenantId, input.tenantId),
        eq(users.userType, "tenant"),
        isNull(users.deletedAt),
      ),
    );
}

export async function revokeTenantUserRefreshTokens(
  db: Database,
  input: { tenantId: string; userId: string },
): Promise<void> {
  await db
    .update(authRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(authRefreshTokens.userId, input.userId),
        eq(authRefreshTokens.tenantId, input.tenantId),
        isNull(authRefreshTokens.revokedAt),
      ),
    );
}

type AuditMeta = { ipAddress?: string; userAgent?: string };

export async function writeTenantUserCreatedAuditLog(
  db: Database,
  input: AuditMeta & {
    actorUserId: string;
    tenantId: string;
    user: TenantUserListItem;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    branchId: input.user.branchIds[0],
    actorUserId: input.actorUserId,
    eventCategory: "tenant_user",
    eventType: "tenant_user.created",
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
      role: input.user.role,
      branchIds: input.user.branchIds,
      status: input.user.status,
    },
  });
}

export async function writeTenantUserUpdatedAuditLog(
  db: Database,
  input: AuditMeta & {
    actorUserId: string;
    tenantId: string;
    userId: string;
    before: TenantUserAuditSnapshot;
    after: TenantUserAuditSnapshot;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    branchId: input.after.branchIds[0] ?? input.before.branchIds[0],
    actorUserId: input.actorUserId,
    eventCategory: "tenant_user",
    eventType: "tenant_user.updated",
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
  input: AuditMeta & {
    actorUserId: string;
    tenantId: string;
    userId: string;
    branchId?: string;
    beforeStatus: string;
    afterStatus: string;
    reason: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    branchId: input.branchId,
    actorUserId: input.actorUserId,
    eventCategory: "tenant_user",
    eventType: "tenant_user.status_updated",
    entityType: "user",
    entityId: input.userId,
    success: true,
    reason: input.reason,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    before: { status: input.beforeStatus },
    after: { status: input.afterStatus },
  });
}

export async function writeTenantUserDeletedAuditLog(
  db: Database,
  input: AuditMeta & {
    actorUserId: string;
    tenantId: string;
    userId: string;
    before: TenantUserAuditSnapshot;
    reason: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    branchId: input.before.branchIds[0],
    actorUserId: input.actorUserId,
    eventCategory: "tenant_user",
    eventType: "tenant_user.deleted",
    entityType: "user",
    entityId: input.userId,
    success: true,
    reason: input.reason,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    before: input.before,
    after: { deleted: true, status: "disabled" },
  });
}

export async function writeTenantUserCredentialResetAuditLog(
  db: Database,
  input: AuditMeta & {
    actorUserId: string;
    tenantId: string;
    userId: string;
    branchId?: string;
    credential: "pin" | "password";
    reason: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    branchId: input.branchId,
    actorUserId: input.actorUserId,
    eventCategory: "tenant_user",
    eventType: `tenant_user.${input.credential}_reset`,
    entityType: "user",
    entityId: input.userId,
    success: true,
    reason: input.reason,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: { credential: input.credential },
  });
}
