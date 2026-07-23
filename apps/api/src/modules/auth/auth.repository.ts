import {
  and,
  eq,
  getTableColumns,
  inArray,
  isNull,
  or,
} from "drizzle-orm";

import {
  authRefreshTokens,
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

export type PosTerminalLoginContext = {
  id: string;
  tenantId: string;
  branchId: string;
  deviceId: string;
  status: "active" | "inactive";
  credentialDigest: string | null;
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

  async findLoginUser({
    identifier,
    tenantCode,
  }: {
    identifier: string;
    tenantCode?: string;
  }): Promise<AuthenticatedUser | null> {
    const normalizedIdentifier = identifier.trim().toLowerCase();

    const rows = await this.db
      .select({
        ...getTableColumns(users),
      })
      .from(users)
      .leftJoin(tenants, eq(users.tenantId, tenants.id))
      .where(
        and(
          isNull(users.deletedAt),
          or(
            eq(users.normalizedEmail, normalizedIdentifier),
            eq(users.phone, identifier.trim()),
          ),
          tenantCode ? eq(tenants.pressingCode, tenantCode) : undefined,
        ),
      )
      .limit(1);

    return rows[0] ?? null;
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

  async getUserAccess(userId: string): Promise<UserAccess> {
    const rows = await this.db
      .select({
        roleCode: roles.code,
        permissionCode: permissions.code,
        branchId: userRoles.branchId,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          isNull(userRoles.revokedAt),
          eq(roles.status, "active"),
          isNull(roles.deletedAt),
        ),
      );

    const profileRows = await this.db
      .select({ displayName: userProfiles.displayName })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    const branchRows = await this.db
      .select({ branchId: userBranches.branchId })
      .from(userBranches)
      .where(eq(userBranches.userId, userId));

    const displayName = profileRows[0]?.displayName ?? userId;

    return {
      roles: [...new Set(rows.map((row) => row.roleCode))],
      permissions: [
        ...new Set(
          rows
            .map((row) => row.permissionCode)
            .filter((code): code is string => Boolean(code)),
        ),
      ],
      branchIds: [
        ...new Set(
          [
            ...rows.map((row) => row.branchId),
            ...branchRows.map((row) => row.branchId),
          ]
            .filter((branchId): branchId is string => Boolean(branchId)),
        ),
      ],
      displayName,
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
          eq(roles.scope, "tenant"),
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
