import { createHash } from "node:crypto";

import { and, eq, getTableColumns, inArray, isNull, sql } from "drizzle-orm";

import {
  authRefreshTokens,
  branches,
  permissions,
  posTerminalSettings,
  rolePermissions,
  roles,
  tenantSettings,
  tenants,
  userBranches,
  userProfiles,
  userRoles,
  users,
  type Database,
} from "@cleanhub/db";

import { writeAuditLog } from "../audit/audit.helper.js";
import { writeSecurityEvent } from "../saas/security/security-events.helper.js";
import type {
  AuthRequestMeta,
  AuthenticatedUser,
  UserAccess,
} from "./auth.types.js";
import {
  isRoleAssignmentAvailableForSession,
  isRoleAssignmentConsistent,
  type LoginSessionKind,
} from "./login-identity.helper.js";

function resolveTenantLanguage(
  value: string | null | undefined,
): "en" | "fr" | "zh-CN" {
  return value === "fr" || value === "zh-CN" ? value : "en";
}

export type PosTerminalLoginContext = {
  id: string;
  tenantId: string;
  branchId: string;
  deviceId: string;
  status: "active" | "inactive";
  credentialDigest: string | null;
  credentialVersion: number;
};

export type PosBootstrapTerminalRecord = PosTerminalLoginContext & {
  label: string | null;
  tenantName: string;
  tenantCode: string;
  tenantStatus: "active" | "suspended" | "disabled";
  tenantDeleted: boolean;
  branchName: string;
  branchStatus: "active" | "inactive";
  branchDeleted: boolean;
};

export type PosBootstrapTenantRecord = {
  id: string;
  name: string;
  code: string;
};

export type ValidatedUserAccess = UserAccess & {
  identityConsistent: boolean;
};

type PosPinLoginCandidateAggregate = {
  user: AuthenticatedUser;
  roleCodes: Set<string>;
  roleBranchIds: Set<string>;
  userBranchIds: Set<string>;
};

export type StoredRefreshToken = {
  id: string;
  userId: string;
  tenantId: string | null;
  deviceId: string | null;
  terminalId: string | null;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
};

export function getPosPinAdvisoryLockKeys(
  terminalId: string,
): readonly [number, number] {
  const digest = createHash("sha256")
    .update("cleanhub-pos-pin-attempt-v1")
    .update("\0")
    .update(terminalId)
    .digest();

  return [digest.readInt32BE(0), digest.readInt32BE(4)] as const;
}

export async function lockPosPinAttempt(
  db: Database,
  terminalId: string,
): Promise<void> {
  const [namespaceKey, terminalKey] = getPosPinAdvisoryLockKeys(terminalId);
  await db.execute(
    sql`select pg_advisory_xact_lock(${namespaceKey}, ${terminalKey})`,
  );
}

export class AuthRepository {
  constructor(private readonly db: Database) {}

  async runInTransaction<T>(
    operation: (repository: AuthRepository, db: Database) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) =>
      operation(new AuthRepository(tx), tx),
    );
  }

  async findLoginUser(identifier: string): Promise<AuthenticatedUser | null> {
    const normalizedIdentifier = identifier.trim().toLowerCase();

    const rows =
      /* tenant-scope: system login identifier lookup */ await this.db
        .select({
          ...getTableColumns(users),
        })
        .from(users)
        .where(
          and(
            isNull(users.deletedAt),
            eq(users.normalizedEmail, normalizedIdentifier),
          ),
        )
        .limit(2);

    return rows.length === 1 ? rows[0]! : null;
  }

  async findUserById(userId: string): Promise<AuthenticatedUser | null> {
    const rows = /* tenant-scope: system user ULID lookup */ await this.db
      .select({
        ...getTableColumns(users),
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    return rows[0] ?? null;
  }

  async isTenantActive(tenantId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(
        and(
          eq(tenants.id, tenantId),
          eq(tenants.status, "active"),
          isNull(tenants.deletedAt),
        ),
      )
      .limit(1);

    return Boolean(rows[0]);
  }

  async getUserAccess(
    user: AuthenticatedUser,
    sessionKind: LoginSessionKind,
  ): Promise<ValidatedUserAccess> {
    const rows = await this.db
      .select({
        roleCode: roles.code,
        roleScope: roles.scope,
        roleTenantId: roles.tenantId,
        assignmentTenantId: userRoles.tenantId,
        permissionCode: permissions.code,
        branchId: userRoles.branchId,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(
        rolePermissions,
        and(
          user.tenantId
            ? eq(rolePermissions.tenantId, user.tenantId)
            : isNull(rolePermissions.tenantId),
          eq(rolePermissions.roleId, roles.id),
        ),
      )
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userRoles.userId, user.id),
          user.tenantId
            ? eq(userRoles.tenantId, user.tenantId)
            : isNull(userRoles.tenantId),
          user.tenantId
            ? eq(roles.tenantId, user.tenantId)
            : isNull(roles.tenantId),
          isNull(userRoles.revokedAt),
          eq(roles.status, "active"),
          isNull(roles.deletedAt),
        ),
      );
    const consistentRows = rows.filter((row) =>
      isRoleAssignmentConsistent(user, row),
    );
    const sessionRows = consistentRows.filter((row) =>
      isRoleAssignmentAvailableForSession(user, row, sessionKind),
    );

    const profileRows = await this.db
      .select({
        displayName: userProfiles.displayName,
        language: userProfiles.language,
        timezone: userProfiles.timezone,
      })
      .from(userProfiles)
      .where(
        and(
          user.tenantId
            ? eq(userProfiles.tenantId, user.tenantId)
            : isNull(userProfiles.tenantId),
          eq(userProfiles.userId, user.id),
        ),
      )
      .limit(1);

    const tenantSettingsRows = user.tenantId
      ? await this.db
          .select({
            defaultLanguage: tenantSettings.defaultLanguage,
            timezone: tenantSettings.timezone,
          })
          .from(tenantSettings)
          .where(eq(tenantSettings.tenantId, user.tenantId))
          .limit(1)
      : [];

    const branchRows = await this.db
      .select({
        branchId: userBranches.branchId,
        tenantId: userBranches.tenantId,
      })
      .from(userBranches)
      .where(eq(userBranches.userId, user.id));
    const validBranchRows = branchRows.filter(
      (row) =>
        user.userType === "tenant" &&
        user.tenantId !== null &&
        row.tenantId === user.tenantId,
    );
    const candidateBranchIds = [
      ...new Set(
        [
          ...sessionRows.map((row) => row.branchId),
          ...validBranchRows.map((row) => row.branchId),
        ].filter((branchId): branchId is string => Boolean(branchId)),
      ),
    ];
    const activeBranchRows =
      user.userType === "tenant" &&
      user.tenantId !== null &&
      candidateBranchIds.length > 0
        ? await this.db
            .select({ id: branches.id })
            .from(branches)
            .where(
              and(
                eq(branches.tenantId, user.tenantId),
                inArray(branches.id, candidateBranchIds),
                eq(branches.status, "active"),
                isNull(branches.deletedAt),
              ),
            )
        : [];

    const displayName = profileRows[0]?.displayName ?? user.id;

    return {
      roles: [...new Set(sessionRows.map((row) => row.roleCode))],
      permissions: [
        ...new Set(
          sessionRows
            .map((row) => row.permissionCode)
            .filter((code): code is string => Boolean(code)),
        ),
      ],
      branchIds: activeBranchRows.map((row) => row.id),
      displayName,
      language: resolveTenantLanguage(
        tenantSettingsRows[0]?.defaultLanguage ??
          profileRows[0]?.language ??
          "en",
      ),
      timezone:
        tenantSettingsRows[0]?.timezone ?? profileRows[0]?.timezone ?? "UTC",
      identityConsistent:
        consistentRows.length === rows.length &&
        validBranchRows.length === branchRows.length,
    };
  }

  async findPosBootstrapTerminalByCredential({
    deviceId,
    credentialDigest,
  }: {
    deviceId: string;
    credentialDigest: string;
  }): Promise<PosBootstrapTerminalRecord | null> {
    const rows = await this.db
      .select({
        id: posTerminalSettings.id,
        tenantId: posTerminalSettings.tenantId,
        branchId: posTerminalSettings.branchId,
        deviceId: posTerminalSettings.deviceId,
        label: posTerminalSettings.label,
        status: posTerminalSettings.status,
        credentialDigest: posTerminalSettings.credentialDigest,
        credentialVersion: posTerminalSettings.credentialVersion,
        tenantName: tenants.name,
        tenantCode: tenants.pressingCode,
        tenantStatus: tenants.status,
        tenantDeletedAt: tenants.deletedAt,
        branchName: branches.name,
        branchStatus: branches.status,
        branchDeletedAt: branches.deletedAt,
      })
      .from(posTerminalSettings)
      .innerJoin(tenants, eq(posTerminalSettings.tenantId, tenants.id))
      .innerJoin(
        branches,
        and(
          eq(posTerminalSettings.branchId, branches.id),
          eq(posTerminalSettings.tenantId, branches.tenantId),
        ),
      )
      .where(
        and(
          eq(posTerminalSettings.deviceId, deviceId),
          eq(posTerminalSettings.credentialDigest, credentialDigest),
        ),
      )
      .limit(1);

    const row = rows[0];
    return row
      ? {
          id: row.id,
          tenantId: row.tenantId,
          branchId: row.branchId,
          deviceId: row.deviceId,
          label: row.label,
          status: row.status,
          credentialDigest: row.credentialDigest,
          credentialVersion: row.credentialVersion,
          tenantName: row.tenantName,
          tenantCode: row.tenantCode,
          tenantStatus: row.tenantStatus,
          tenantDeleted: Boolean(row.tenantDeletedAt),
          branchName: row.branchName,
          branchStatus: row.branchStatus,
          branchDeleted: Boolean(row.branchDeletedAt),
        }
      : null;
  }

  async findPosBootstrapTerminalByTenantAndDevice({
    tenantId,
    deviceId,
  }: {
    tenantId: string;
    deviceId: string;
  }): Promise<PosBootstrapTerminalRecord | null> {
    const rows = await this.db
      .select({
        id: posTerminalSettings.id,
        tenantId: posTerminalSettings.tenantId,
        branchId: posTerminalSettings.branchId,
        deviceId: posTerminalSettings.deviceId,
        label: posTerminalSettings.label,
        status: posTerminalSettings.status,
        credentialDigest: posTerminalSettings.credentialDigest,
        credentialVersion: posTerminalSettings.credentialVersion,
        tenantName: tenants.name,
        tenantCode: tenants.pressingCode,
        tenantStatus: tenants.status,
        tenantDeletedAt: tenants.deletedAt,
        branchName: branches.name,
        branchStatus: branches.status,
        branchDeletedAt: branches.deletedAt,
      })
      .from(posTerminalSettings)
      .innerJoin(tenants, eq(posTerminalSettings.tenantId, tenants.id))
      .innerJoin(
        branches,
        and(
          eq(posTerminalSettings.branchId, branches.id),
          eq(posTerminalSettings.tenantId, branches.tenantId),
        ),
      )
      .where(
        and(
          eq(posTerminalSettings.tenantId, tenantId),
          eq(posTerminalSettings.deviceId, deviceId),
        ),
      )
      .limit(1);

    const row = rows[0];
    return row
      ? {
          id: row.id,
          tenantId: row.tenantId,
          branchId: row.branchId,
          deviceId: row.deviceId,
          label: row.label,
          status: row.status,
          credentialDigest: row.credentialDigest,
          credentialVersion: row.credentialVersion,
          tenantName: row.tenantName,
          tenantCode: row.tenantCode,
          tenantStatus: row.tenantStatus,
          tenantDeleted: Boolean(row.tenantDeletedAt),
          branchName: row.branchName,
          branchStatus: row.branchStatus,
          branchDeleted: Boolean(row.branchDeletedAt),
        }
      : null;
  }

  async findPosBootstrapTenant(
    tenantId: string,
  ): Promise<PosBootstrapTenantRecord | null> {
    const rows = await this.db
      .select({
        id: tenants.id,
        name: tenants.name,
        code: tenants.pressingCode,
      })
      .from(tenants)
      .where(
        and(
          eq(tenants.id, tenantId),
          eq(tenants.status, "active"),
          isNull(tenants.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async findPosTerminalById(
    terminalId: string,
  ): Promise<PosTerminalLoginContext | null> {
    const rows = await this.db
      .select({
        id: posTerminalSettings.id,
        tenantId: posTerminalSettings.tenantId,
        branchId: posTerminalSettings.branchId,
        deviceId: posTerminalSettings.deviceId,
        status: posTerminalSettings.status,
        credentialDigest: posTerminalSettings.credentialDigest,
        credentialVersion: posTerminalSettings.credentialVersion,
      })
      .from(posTerminalSettings)
      .innerJoin(tenants, eq(posTerminalSettings.tenantId, tenants.id))
      .innerJoin(
        branches,
        and(
          eq(posTerminalSettings.branchId, branches.id),
          eq(posTerminalSettings.tenantId, branches.tenantId),
        ),
      )
      .where(
        and(
          eq(posTerminalSettings.id, terminalId),
          eq(tenants.status, "active"),
          isNull(tenants.deletedAt),
          eq(branches.status, "active"),
          isNull(branches.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async lockPosTerminalById(input: {
    tenantId: string;
    terminalId: string;
  }): Promise<boolean> {
    const rows = await this.db
      .select({ id: posTerminalSettings.id })
      .from(posTerminalSettings)
      .where(
        and(
          eq(posTerminalSettings.tenantId, input.tenantId),
          eq(posTerminalSettings.id, input.terminalId),
        ),
      )
      .for("update")
      .limit(1);

    return Boolean(rows[0]);
  }

  async markPosTerminalCredentialUsed(input: {
    tenantId: string;
    terminalId: string;
  }): Promise<void> {
    const now = new Date();
    await this.db
      .update(posTerminalSettings)
      .set({
        credentialLastUsedAt: now,
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(posTerminalSettings.tenantId, input.tenantId),
          eq(posTerminalSettings.id, input.terminalId),
        ),
      );
  }

  async findPosPinLoginCandidates({
    tenantId,
    branchId,
  }: {
    tenantId: string;
    branchId?: string | null;
  }): Promise<AuthenticatedUser[]> {
    const rows = await this.db
      .select({
        ...getTableColumns(users),
        roleCode: roles.code,
        roleBranchId: userRoles.branchId,
      })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.userType, "tenant"),
          isNull(users.deletedAt),
          eq(userRoles.tenantId, tenantId),
          isNull(userRoles.revokedAt),
          eq(roles.tenantId, tenantId),
          inArray(roles.scope, ["tenant", "pos"]),
          inArray(roles.code, ["owner", "manager", "cashier"]),
          eq(roles.status, "active"),
          isNull(roles.deletedAt),
        ),
      );

    const aggregates = new Map<string, PosPinLoginCandidateAggregate>();

    for (const row of rows) {
      const { roleCode, roleBranchId, ...user } = row;
      const existing = aggregates.get(user.id);

      if (existing) {
        existing.roleCodes.add(roleCode);
        if (roleBranchId) existing.roleBranchIds.add(roleBranchId);
        continue;
      }

      aggregates.set(user.id, {
        user,
        roleCodes: new Set([roleCode]),
        roleBranchIds: new Set(roleBranchId ? [roleBranchId] : []),
        userBranchIds: new Set(),
      });
    }

    const userIds = [...aggregates.keys()];

    if (userIds.length > 0) {
      const branchRows = await this.db
        .select({
          userId: userBranches.userId,
          branchId: userBranches.branchId,
        })
        .from(userBranches)
        .where(
          and(
            eq(userBranches.tenantId, tenantId),
            inArray(userBranches.userId, userIds),
          ),
        );

      for (const row of branchRows) {
        aggregates.get(row.userId)?.userBranchIds.add(row.branchId);
      }
    }

    return [...aggregates.values()]
      .filter((candidate) => {
        if (!branchId) {
          return true;
        }

        return (
          candidate.roleCodes.has("owner") ||
          candidate.roleBranchIds.has(branchId) ||
          candidate.userBranchIds.has(branchId)
        );
      })
      .map((candidate) => candidate.user);
  }

  async updateLastLoginAt(input: {
    tenantId: string | null;
    userId: string;
  }): Promise<void> {
    await this.db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          input.tenantId
            ? eq(users.tenantId, input.tenantId)
            : isNull(users.tenantId),
          eq(users.id, input.userId),
        ),
      );
  }

  async createRefreshToken({
    userId,
    tenantId,
    tokenHash,
    familyId,
    expiresAt,
    terminalId,
    meta,
  }: {
    userId: string;
    tenantId: string | null;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    terminalId?: string;
    meta?: AuthRequestMeta;
  }): Promise<string> {
    const rows = await this.db
      .insert(authRefreshTokens)
      .values({
        userId,
        tenantId,
        tokenHash,
        familyId,
        deviceId: meta?.deviceId,
        terminalId,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
        expiresAt,
      })
      .returning({ id: authRefreshTokens.id });

    return rows[0]?.id ?? "";
  }

  async createWebRefreshTokenReplacingDeviceSessions({
    userId,
    tenantId,
    tokenHash,
    familyId,
    expiresAt,
    meta,
  }: {
    userId: string;
    tenantId: string | null;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    meta?: AuthRequestMeta;
  }): Promise<string> {
    return this.db.transaction(async (tx) => {
      if (meta?.deviceId) {
        await tx
          .update(authRefreshTokens)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(authRefreshTokens.userId, userId),
              tenantId === null
                ? isNull(authRefreshTokens.tenantId)
                : eq(authRefreshTokens.tenantId, tenantId),
              eq(authRefreshTokens.deviceId, meta.deviceId),
              isNull(authRefreshTokens.terminalId),
              isNull(authRefreshTokens.revokedAt),
            ),
          );
      }

      const rows = await tx
        .insert(authRefreshTokens)
        .values({
          userId,
          tenantId,
          tokenHash,
          familyId,
          deviceId: meta?.deviceId,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          expiresAt,
        })
        .returning({ id: authRefreshTokens.id });

      return rows[0]?.id ?? "";
    });
  }

  async findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<StoredRefreshToken | null> {
    const rows = await this.db
      .select({
        id: authRefreshTokens.id,
        userId: authRefreshTokens.userId,
        tenantId: authRefreshTokens.tenantId,
        deviceId: authRefreshTokens.deviceId,
        terminalId: authRefreshTokens.terminalId,
        tokenHash: authRefreshTokens.tokenHash,
        familyId: authRefreshTokens.familyId,
        expiresAt: authRefreshTokens.expiresAt,
        revokedAt: authRefreshTokens.revokedAt,
        replacedByTokenId: authRefreshTokens.replacedByTokenId,
      })
      .from(authRefreshTokens)
      .where(eq(authRefreshTokens.tokenHash, tokenHash))
      .limit(1);

    return rows[0] ?? null;
  }

  async findRefreshTokenByHashForUpdate(
    tokenHash: string,
  ): Promise<StoredRefreshToken | null> {
    const rows = await this.db
      .select({
        id: authRefreshTokens.id,
        userId: authRefreshTokens.userId,
        tenantId: authRefreshTokens.tenantId,
        deviceId: authRefreshTokens.deviceId,
        terminalId: authRefreshTokens.terminalId,
        tokenHash: authRefreshTokens.tokenHash,
        familyId: authRefreshTokens.familyId,
        expiresAt: authRefreshTokens.expiresAt,
        revokedAt: authRefreshTokens.revokedAt,
        replacedByTokenId: authRefreshTokens.replacedByTokenId,
      })
      .from(authRefreshTokens)
      .where(eq(authRefreshTokens.tokenHash, tokenHash))
      .for("update")
      .limit(1);

    return rows[0] ?? null;
  }

  async findRefreshTokenByIdForUpdate(
    tokenId: string,
  ): Promise<StoredRefreshToken | null> {
    const rows = await this.db
      .select({
        id: authRefreshTokens.id,
        userId: authRefreshTokens.userId,
        tenantId: authRefreshTokens.tenantId,
        deviceId: authRefreshTokens.deviceId,
        terminalId: authRefreshTokens.terminalId,
        tokenHash: authRefreshTokens.tokenHash,
        familyId: authRefreshTokens.familyId,
        expiresAt: authRefreshTokens.expiresAt,
        revokedAt: authRefreshTokens.revokedAt,
        replacedByTokenId: authRefreshTokens.replacedByTokenId,
      })
      .from(authRefreshTokens)
      .where(eq(authRefreshTokens.id, tokenId))
      .for("update")
      .limit(1);

    return rows[0] ?? null;
  }

  async revokeRefreshToken({
    tenantId,
    tokenId,
    replacedByTokenId,
  }: {
    tenantId: string | null;
    tokenId: string;
    replacedByTokenId?: string;
  }): Promise<void> {
    await this.db
      .update(authRefreshTokens)
      .set({
        revokedAt: new Date(),
        replacedByTokenId,
      })
      .where(
        and(
          tenantId
            ? eq(authRefreshTokens.tenantId, tenantId)
            : isNull(authRefreshTokens.tenantId),
          eq(authRefreshTokens.id, tokenId),
        ),
      );
  }

  async revokeRefreshTokenFamily(input: {
    tenantId: string | null;
    familyId: string;
  }): Promise<void> {
    await this.db
      .update(authRefreshTokens)
      .set({
        revokedAt: new Date(),
      })
      .where(
        and(
          input.tenantId
            ? eq(authRefreshTokens.tenantId, input.tenantId)
            : isNull(authRefreshTokens.tenantId),
          eq(authRefreshTokens.familyId, input.familyId),
        ),
      );
  }

  async revokeRefreshTokenByRawHash(input: {
    tenantId: string | null;
    tokenHash: string;
  }): Promise<void> {
    await this.db
      .update(authRefreshTokens)
      .set({
        revokedAt: new Date(),
      })
      .where(
        and(
          input.tenantId
            ? eq(authRefreshTokens.tenantId, input.tenantId)
            : isNull(authRefreshTokens.tenantId),
          eq(authRefreshTokens.tokenHash, input.tokenHash),
        ),
      );
  }

  async writeAuditLog({
    tenantId,
    actorUserId,
    eventType,
    success,
    reason,
    meta,
    metadata,
  }: {
    tenantId?: string | null;
    actorUserId?: string | null;
    eventType: string;
    success: boolean;
    reason?: string;
    meta?: AuthRequestMeta;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await writeAuditLog(this.db, {
      tenantId,
      actorUserId,
      eventCategory: "auth",
      eventType,
      success,
      reason,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      metadata,
    });

    if (eventType === "auth.login.failed") {
      await writeSecurityEvent(this.db, {
        tenantId,
        actorUserId,
        eventType,
        severity: "medium",
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
        description: "Login attempt failed.",
        metadata: {
          reason,
          ...metadata,
        },
      });
    }
  }
}
