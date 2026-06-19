import {
  and,
  eq,
  getTableColumns,
  isNull,
  or,
} from "drizzle-orm";

import {
  authRefreshTokens,
  permissions,
  rolePermissions,
  roles,
  tenants,
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

export type StoredRefreshToken = {
  id: string;
  userId: string;
  tenantId: string | null;
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
          rows
            .map((row) => row.branchId)
            .filter((branchId): branchId is string => Boolean(branchId)),
        ),
      ],
      displayName,
    };
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
    meta,
  }: {
    userId: string;
    tenantId: string | null;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
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
