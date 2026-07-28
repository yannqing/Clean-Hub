import {
  and,
  eq,
  getTableColumns,
  inArray,
  isNull,
} from "drizzle-orm";

import {
  authRefreshTokens,
  branches,
  permissions,
  posTerminalSettings,
  rolePermissions,
  roles,
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

export type PosTerminalLoginContext = {
  id: string;
  tenantId: string;
  branchId: string;
  deviceId: string;
  status: "active" | "inactive";
  credentialDigest: string | null;
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
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export class AuthRepository {
  constructor(private readonly db: Database) {}

  async findLoginUser(identifier: string): Promise<AuthenticatedUser | null> {
    const normalizedIdentifier = identifier.trim().toLowerCase();

    const rows = await this.db
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
    const rows = await this.db
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
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userRoles.userId, user.id),
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
      .select({ displayName: userProfiles.displayName })
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

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
      identityConsistent:
        consistentRows.length === rows.length &&
        validBranchRows.length === branchRows.length,
    };
  }

  async findPosTerminalLoginContext({
    tenantCode,
    deviceId,
  }: {
    tenantCode: string;
    deviceId: string;
  }): Promise<PosTerminalLoginContext | null> {
    const rows = await this.db
      .select({
        tenantId: tenants.id,
        tenantStatus: tenants.status,
        terminalId: posTerminalSettings.id,
        terminalBranchId: posTerminalSettings.branchId,
        terminalDeviceId: posTerminalSettings.deviceId,
        terminalStatus: posTerminalSettings.status,
        terminalCredentialDigest: posTerminalSettings.credentialDigest,
      })
      .from(tenants)
      .innerJoin(
        posTerminalSettings,
        and(
          eq(posTerminalSettings.tenantId, tenants.id),
          eq(posTerminalSettings.deviceId, deviceId),
        ),
      )
      .where(
        and(
          eq(tenants.pressingCode, tenantCode.trim()),
          isNull(tenants.deletedAt),
        ),
      )
      .limit(1);

    const row = rows[0];

    if (!row || row.tenantStatus !== "active") {
      return null;
    }

    if (
      !row.terminalId ||
      !row.terminalBranchId ||
      !row.terminalDeviceId ||
      !row.terminalStatus
    ) {
      return null;
    }

    return {
      id: row.terminalId,
      tenantId: row.tenantId,
      branchId: row.terminalBranchId,
      deviceId: row.terminalDeviceId,
      status: row.terminalStatus,
      credentialDigest: row.terminalCredentialDigest,
    };
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
      })
      .from(posTerminalSettings)
      .innerJoin(tenants, eq(posTerminalSettings.tenantId, tenants.id))
      .where(
        and(
          eq(posTerminalSettings.id, terminalId),
          eq(tenants.status, "active"),
          isNull(tenants.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async markPosTerminalCredentialUsed(terminalId: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(posTerminalSettings)
      .set({
        credentialLastUsedAt: now,
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(posTerminalSettings.id, terminalId));
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

  async updateLastLoginAt(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
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
        familyId: authRefreshTokens.familyId,
        expiresAt: authRefreshTokens.expiresAt,
        revokedAt: authRefreshTokens.revokedAt,
      })
      .from(authRefreshTokens)
      .where(eq(authRefreshTokens.tokenHash, tokenHash))
      .limit(1);

    return rows[0] ?? null;
  }

  async revokeRefreshToken({
    tokenId,
    replacedByTokenId,
  }: {
    tokenId: string;
    replacedByTokenId?: string;
  }): Promise<void> {
    await this.db
      .update(authRefreshTokens)
      .set({
        revokedAt: new Date(),
        replacedByTokenId,
      })
      .where(eq(authRefreshTokens.id, tokenId));
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await this.db
      .update(authRefreshTokens)
      .set({
        revokedAt: new Date(),
      })
      .where(eq(authRefreshTokens.familyId, familyId));
  }

  async revokeRefreshTokenByRawHash(tokenHash: string): Promise<void> {
    await this.db
      .update(authRefreshTokens)
      .set({
        revokedAt: new Date(),
      })
      .where(eq(authRefreshTokens.tokenHash, tokenHash));
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
