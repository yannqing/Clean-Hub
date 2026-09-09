import { and, asc, desc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";

import {
  authRefreshTokens,
  branches,
  roles,
  tenants,
  userProfiles,
  userRoles,
  users,
  type Database,
} from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import type {
  TenantProfileLanguage,
  TenantLoginSessionRecord,
  TenantProfileMutableFields,
  TenantProfileRecord,
  TenantProfileRole,
} from "./profile.types.js";

function resolveLanguage(value: string | null): TenantProfileLanguage {
  if (value === "fr" || value === "zh-CN") {
    return value;
  }

  return "en";
}

export async function findTenantSelfProfile(
  db: Database,
  input: {
    tenantId: string;
    userId: string;
    allowedBranchIds?: string[];
  },
): Promise<TenantProfileRecord | null> {
  const rows = await db
    .select({
      userId: users.id,
      tenantId: tenants.id,
      email: users.email,
      phone: users.phone,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      displayName: userProfiles.displayName,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
      language: userProfiles.language,
      timezone: userProfiles.timezone,
      profileUpdatedAt: userProfiles.updatedAt,
      tenantName: tenants.name,
      pressingCode: tenants.pressingCode,
    })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .leftJoin(
      userProfiles,
      and(
        eq(userProfiles.userId, users.id),
        eq(userProfiles.tenantId, input.tenantId),
      ),
    )
    .where(
      and(
        eq(users.id, input.userId),
        eq(users.tenantId, input.tenantId),
        eq(users.userType, "tenant"),
        isNull(users.deletedAt),
        eq(tenants.id, input.tenantId),
        isNull(tenants.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  const branchFilters = [
    eq(branches.tenantId, input.tenantId),
    isNull(branches.deletedAt),
  ];
  const accessibleBranchRows =
    input.allowedBranchIds?.length === 0
      ? []
      : await db
          .select({
            id: branches.id,
            name: branches.name,
            defaultLanguage: branches.defaultLanguage,
            status: branches.status,
          })
          .from(branches)
          .where(
            and(
              ...branchFilters,
              input.allowedBranchIds
                ? inArray(branches.id, input.allowedBranchIds)
                : undefined,
            ),
          )
          .orderBy(asc(branches.name));
  const accessibleBranches = accessibleBranchRows.map((branch) => ({
    ...branch,
    defaultLanguage: resolveLanguage(branch.defaultLanguage),
  }));

  const roleRows = await db
    .select({
      code: roles.code,
      name: roles.name,
      branchId: userRoles.branchId,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        eq(userRoles.userId, input.userId),
        eq(userRoles.tenantId, input.tenantId),
        isNull(userRoles.revokedAt),
        eq(roles.tenantId, input.tenantId),
        eq(roles.scope, "tenant"),
        eq(roles.status, "active"),
        isNull(roles.deletedAt),
      ),
    )
    .orderBy(asc(roles.name), asc(userRoles.branchId));

  const profileRoles: TenantProfileRole[] = roleRows.map((role) => ({
    code: role.code,
    name: role.name,
    branchId: role.branchId,
  }));

  return {
    userId: row.userId,
    tenantId: row.tenantId,
    displayName: row.displayName ?? row.email ?? row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    language: resolveLanguage(row.language),
    timezone: row.timezone ?? "UTC",
    email: row.email,
    phone: row.phone,
    status: row.status,
    roles: profileRoles,
    tenant: {
      id: row.tenantId,
      name: row.tenantName,
      pressingCode: row.pressingCode,
    },
    accessibleBranches,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    profileUpdatedAt: row.profileUpdatedAt?.toISOString() ?? null,
  };
}

export async function updateTenantSelfProfileRecord(
  db: Database,
  input: {
    userId: string;
    tenantId: string;
    fields: TenantProfileMutableFields;
    updateIdentity: boolean;
    updateProfile: boolean;
  },
): Promise<void> {
  const now = new Date();

  if (input.updateIdentity) {
    const email = input.fields.email?.trim().toLowerCase() ?? null;
    const phone = input.fields.phone?.trim() || null;

    await db
      .update(users)
      .set({
        email,
        normalizedEmail: email,
        phone,
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
      );
  }

  if (input.updateProfile) {
    await db
      .insert(userProfiles)
      .values({
        userId: input.userId,
        tenantId: input.tenantId,
        displayName: input.fields.displayName.trim(),
        language: input.fields.language,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          tenantId: input.tenantId,
          displayName: input.fields.displayName.trim(),
          language: input.fields.language,
          updatedAt: now,
        },
      });
  }
}

export async function findTenantUserCredential(
  db: Database,
  input: { tenantId: string; userId: string },
): Promise<{ passwordHash: string } | null> {
  const rows = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(
      and(
        eq(users.id, input.userId),
        eq(users.tenantId, input.tenantId),
        eq(users.userType, "tenant"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function updateTenantUserPasswordRecord(
  db: Database,
  input: {
    tenantId: string;
    userId: string;
    expectedPasswordHash: string;
    passwordHash: string;
  },
): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({
      passwordHash: input.passwordHash,
      updatedAt: new Date(),
      version: sql`${users.version} + 1`,
    })
    .where(
      and(
        eq(users.id, input.userId),
        eq(users.tenantId, input.tenantId),
        eq(users.userType, "tenant"),
        eq(users.passwordHash, input.expectedPasswordHash),
        isNull(users.deletedAt),
      ),
    )
    .returning({ id: users.id });

  return Boolean(rows[0]);
}

export async function revokeTenantUserRefreshTokens(
  db: Database,
  input: { tenantId: string; userId: string },
): Promise<number> {
  const rows = await db
    .update(authRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(authRefreshTokens.userId, input.userId),
        eq(authRefreshTokens.tenantId, input.tenantId),
        gt(authRefreshTokens.expiresAt, new Date()),
        isNull(authRefreshTokens.revokedAt),
      ),
    )
    .returning({ id: authRefreshTokens.id });

  return rows.length;
}

export async function findTenantLoginSessionFamilyIdByTokenHash(
  db: Database,
  input: { tenantId: string; userId: string; tokenHash: string },
): Promise<string | null> {
  const rows = await db
    .select({ familyId: authRefreshTokens.familyId })
    .from(authRefreshTokens)
    .where(
      and(
        eq(authRefreshTokens.userId, input.userId),
        eq(authRefreshTokens.tenantId, input.tenantId),
        eq(authRefreshTokens.tokenHash, input.tokenHash),
        isNull(authRefreshTokens.terminalId),
      ),
    )
    .limit(1);

  return rows[0]?.familyId ?? null;
}

export async function listTenantLoginSessionRecords(
  db: Database,
  input: { tenantId: string; userId: string },
): Promise<TenantLoginSessionRecord[]> {
  const now = new Date();
  const activeTokens = await db
    .select({
      id: authRefreshTokens.familyId,
      deviceId: authRefreshTokens.deviceId,
      userAgent: authRefreshTokens.userAgent,
      ipAddress: authRefreshTokens.ipAddress,
      lastActiveAt: authRefreshTokens.createdAt,
      expiresAt: authRefreshTokens.expiresAt,
    })
    .from(authRefreshTokens)
    .where(
      and(
        eq(authRefreshTokens.userId, input.userId),
        eq(authRefreshTokens.tenantId, input.tenantId),
        isNull(authRefreshTokens.terminalId),
        isNull(authRefreshTokens.revokedAt),
        gt(authRefreshTokens.expiresAt, now),
      ),
    )
    .orderBy(desc(authRefreshTokens.createdAt));

  if (activeTokens.length === 0) {
    return [];
  }

  const familyIds = [...new Set(activeTokens.map((token) => token.id))];
  const familyStarts = await db
    .select({
      familyId: authRefreshTokens.familyId,
      signedInAt: sql<Date>`min(${authRefreshTokens.createdAt})`.as(
        "signed_in_at",
      ),
    })
    .from(authRefreshTokens)
    .where(
      and(
        eq(authRefreshTokens.userId, input.userId),
        eq(authRefreshTokens.tenantId, input.tenantId),
        isNull(authRefreshTokens.terminalId),
        inArray(authRefreshTokens.familyId, familyIds),
      ),
    )
    .groupBy(authRefreshTokens.familyId);
  const signedInAtByFamily = new Map(
    familyStarts.map((row) => [row.familyId, row.signedInAt]),
  );

  return activeTokens.map((token) => ({
    ...token,
    signedInAt: signedInAtByFamily.get(token.id) ?? token.lastActiveAt,
  }));
}

export async function findTenantLoginSessionRecord(
  db: Database,
  input: { tenantId: string; userId: string; sessionId: string },
): Promise<TenantLoginSessionRecord | null> {
  const sessions = await listTenantLoginSessionRecords(db, input);
  return sessions.find((session) => session.id === input.sessionId) ?? null;
}

export async function revokeTenantLoginDeviceSessions(
  db: Database,
  input: {
    tenantId: string;
    userId: string;
    session: TenantLoginSessionRecord;
    currentFamilyId: string | null;
  },
): Promise<number> {
  const deviceFilter = input.session.deviceId
    ? eq(authRefreshTokens.deviceId, input.session.deviceId)
    : isNull(authRefreshTokens.deviceId);
  const rows = await db
    .update(authRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(authRefreshTokens.userId, input.userId),
        eq(authRefreshTokens.tenantId, input.tenantId),
        isNull(authRefreshTokens.terminalId),
        isNull(authRefreshTokens.revokedAt),
        gt(authRefreshTokens.expiresAt, new Date()),
        deviceFilter,
        input.currentFamilyId
          ? ne(authRefreshTokens.familyId, input.currentFamilyId)
          : undefined,
      ),
    )
    .returning({ id: authRefreshTokens.id });

  return rows.length;
}

export async function writeTenantLoginSessionRevokedAuditLog(
  db: Database,
  input: {
    tenantId: string;
    actorUserId: string;
    sessionId: string;
    deviceId: string | null;
    sessionsRevoked: number;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "auth",
    eventType: "auth.session.revoked",
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: {
      sessionId: input.sessionId,
      deviceId: input.deviceId,
      sessionsRevoked: input.sessionsRevoked,
    },
  });
}

export async function writeTenantProfileUpdatedAuditLog(
  db: Database,
  input: {
    tenantId: string;
    actorUserId: string;
    before: TenantProfileMutableFields;
    after: TenantProfileMutableFields;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "tenant_profile",
    eventType: "tenant_profile.updated",
    entityType: "user_profile",
    entityId: input.actorUserId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    before: input.before,
    after: input.after,
  });
}

export async function writeTenantPasswordChangedAuditLog(
  db: Database,
  input: {
    tenantId: string;
    actorUserId: string;
    sessionsRevoked: number;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "security",
    eventType: "tenant_profile.password_changed",
    entityType: "user",
    entityId: input.actorUserId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: {
      sessionsRevoked: input.sessionsRevoked,
    },
  });
}
