import { createId } from "@cleanhub/id";
import { and, desc, eq, getTableColumns, isNull, or, sql } from "drizzle-orm";

import {
  authRefreshTokens,
  customerAccounts,
  customerAuthOtps,
  customerAuthRefreshTokens,
  customerCredentials,
  permissions,
  rolePermissions,
  roles,
  tenantSettings,
  tenants,
  userProfiles,
  userRoles,
  users,
  type Database,
} from "@cleanhub/db";

import type { AuthRequestMeta, UserAccess } from "../../auth/auth.types.js";
import type {
  MobileCustomerAccount,
  MobileCustomerCredential,
  MobileCustomerOtp,
  MobileStaffUser,
  MobileStoredRefreshToken,
} from "./auth.types.js";

export class MobileAuthRepository {
  constructor(private readonly db: Database) {}

  async findActiveTenantByCode(tenantCode: string): Promise<{
    id: string;
    defaultCurrency: string;
    timezone?: string;
  } | null> {
    const rows = await this.db
      .select({
        id: tenants.id,
        defaultCurrency: sql<string>`coalesce(${tenantSettings.defaultCurrency}, 'XOF')`,
        timezone: sql<string>`coalesce(${tenantSettings.timezone}, 'UTC')`,
      })
      .from(tenants)
      .leftJoin(tenantSettings, eq(tenantSettings.tenantId, tenants.id))
      .where(
        and(
          eq(tenants.pressingCode, tenantCode.trim()),
          eq(tenants.status, "active"),
          isNull(tenants.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async findTenantById(tenantId: string): Promise<{
    id: string;
    defaultCurrency: string;
    timezone?: string;
  } | null> {
    const rows = await this.db
      .select({
        id: tenants.id,
        defaultCurrency: sql<string>`coalesce(${tenantSettings.defaultCurrency}, 'XOF')`,
        timezone: sql<string>`coalesce(${tenantSettings.timezone}, 'UTC')`,
      })
      .from(tenants)
      .leftJoin(tenantSettings, eq(tenantSettings.tenantId, tenants.id))
      .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
      .limit(1);

    return rows[0] ?? null;
  }

  async findCustomerByPhone({
    tenantId,
    phone,
  }: {
    tenantId: string;
    phone: string;
  }): Promise<MobileCustomerAccount | null> {
    const rows = await this.db
      .select({
        id: customerAccounts.id,
        tenantId: customerAccounts.tenantId,
        accountName: customerAccounts.accountName,
        phone: customerAccounts.phone,
        email: customerAccounts.email,
        status: customerAccounts.status,
      })
      .from(customerAccounts)
      .where(
        and(
          eq(customerAccounts.tenantId, tenantId),
          eq(customerAccounts.phone, phone.trim()),
          isNull(customerAccounts.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async findCustomerByIdentifier({
    tenantId,
    identifier,
  }: {
    tenantId: string;
    identifier: string;
  }): Promise<MobileCustomerAccount | null> {
    const normalizedIdentifier = identifier.trim().toLowerCase();

    const rows = await this.db
      .select({
        id: customerAccounts.id,
        tenantId: customerAccounts.tenantId,
        accountName: customerAccounts.accountName,
        phone: customerAccounts.phone,
        email: customerAccounts.email,
        status: customerAccounts.status,
      })
      .from(customerAccounts)
      .where(
        and(
          eq(customerAccounts.tenantId, tenantId),
          or(
            eq(customerAccounts.phone, identifier.trim()),
            eq(customerAccounts.email, normalizedIdentifier),
          ),
          isNull(customerAccounts.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async findCustomerById({
    tenantId,
    customerAccountId,
  }: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<MobileCustomerAccount | null> {
    const rows = await this.db
      .select({
        id: customerAccounts.id,
        tenantId: customerAccounts.tenantId,
        accountName: customerAccounts.accountName,
        phone: customerAccounts.phone,
        email: customerAccounts.email,
        status: customerAccounts.status,
      })
      .from(customerAccounts)
      .where(
        and(
          eq(customerAccounts.tenantId, tenantId),
          eq(customerAccounts.id, customerAccountId),
          isNull(customerAccounts.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async findCustomerCredential(input: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<MobileCustomerCredential | null> {
    const rows = await this.db
      .select({
        id: customerCredentials.id,
        tenantId: customerCredentials.tenantId,
        customerAccountId: customerCredentials.customerAccountId,
        passwordHash: customerCredentials.passwordHash,
        failedAttempts: customerCredentials.failedAttempts,
        lockedUntil: customerCredentials.lockedUntil,
      })
      .from(customerCredentials)
      .where(
        and(
          eq(customerCredentials.tenantId, input.tenantId),
          eq(customerCredentials.customerAccountId, input.customerAccountId),
          isNull(customerCredentials.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async createCustomerOtp({
    tenantId,
    customerAccountId,
    phone,
    code,
    expiresAt,
  }: {
    tenantId: string;
    customerAccountId: string;
    phone: string;
    code: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.insert(customerAuthOtps).values({
      id: createId(),
      tenantId,
      customerAccountId,
      phone,
      code,
      purpose: "login",
      expiresAt,
    });
  }

  async findLatestCustomerOtp({
    tenantId,
    customerAccountId,
    phone,
  }: {
    tenantId: string;
    customerAccountId: string;
    phone: string;
  }): Promise<MobileCustomerOtp | null> {
    const rows = await this.db
      .select({
        id: customerAuthOtps.id,
        tenantId: customerAuthOtps.tenantId,
        customerAccountId: customerAuthOtps.customerAccountId,
        phone: customerAuthOtps.phone,
        code: customerAuthOtps.code,
        attempts: customerAuthOtps.attempts,
        maxAttempts: customerAuthOtps.maxAttempts,
        expiresAt: customerAuthOtps.expiresAt,
        consumedAt: customerAuthOtps.consumedAt,
      })
      .from(customerAuthOtps)
      .where(
        and(
          eq(customerAuthOtps.tenantId, tenantId),
          eq(customerAuthOtps.customerAccountId, customerAccountId),
          eq(customerAuthOtps.phone, phone),
          eq(customerAuthOtps.purpose, "login"),
          isNull(customerAuthOtps.deletedAt),
        ),
      )
      .orderBy(desc(customerAuthOtps.createdAt))
      .limit(1);

    return rows[0] ?? null;
  }

  async incrementCustomerOtpAttempts(input: {
    tenantId: string;
    otpId: string;
  }): Promise<void> {
    const rows = await this.db
      .select({ attempts: customerAuthOtps.attempts })
      .from(customerAuthOtps)
      .where(
        and(
          eq(customerAuthOtps.tenantId, input.tenantId),
          eq(customerAuthOtps.id, input.otpId),
        ),
      )
      .limit(1);

    await this.db
      .update(customerAuthOtps)
      .set({
        attempts: (rows[0]?.attempts ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customerAuthOtps.tenantId, input.tenantId),
          eq(customerAuthOtps.id, input.otpId),
        ),
      );
  }

  async consumeCustomerOtp(input: {
    tenantId: string;
    otpId: string;
  }): Promise<void> {
    await this.db
      .update(customerAuthOtps)
      .set({
        consumedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customerAuthOtps.tenantId, input.tenantId),
          eq(customerAuthOtps.id, input.otpId),
        ),
      );
  }

  async recordCustomerPasswordFailure({
    credentialId,
    tenantId,
    failedAttempts,
    lockedUntil,
  }: {
    credentialId: string;
    tenantId: string;
    failedAttempts: number;
    lockedUntil: Date | null;
  }): Promise<void> {
    await this.db
      .update(customerCredentials)
      .set({
        failedAttempts,
        lockedUntil,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customerCredentials.tenantId, tenantId),
          eq(customerCredentials.id, credentialId),
        ),
      );
  }

  async clearCustomerPasswordFailures(input: {
    tenantId: string;
    credentialId: string;
  }): Promise<void> {
    await this.db
      .update(customerCredentials)
      .set({
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customerCredentials.tenantId, input.tenantId),
          eq(customerCredentials.id, input.credentialId),
        ),
      );
  }

  async createCustomerRefreshToken({
    customerAccountId,
    tenantId,
    tokenHash,
    familyId,
    expiresAt,
    meta,
  }: {
    customerAccountId: string;
    tenantId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    meta?: AuthRequestMeta;
  }): Promise<string> {
    const rows = await this.db
      .insert(customerAuthRefreshTokens)
      .values({
        id: createId(),
        customerAccountId,
        tenantId,
        tokenHash,
        familyId,
        expiresAt,
        deviceId: meta?.deviceId,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      })
      .returning({ id: customerAuthRefreshTokens.id });

    return rows[0]?.id ?? "";
  }

  async findCustomerRefreshTokenByHash(
    tokenHash: string,
  ): Promise<MobileStoredRefreshToken | null> {
    const rows = await this.db
      .select({
        id: customerAuthRefreshTokens.id,
        subjectId: customerAuthRefreshTokens.customerAccountId,
        tenantId: customerAuthRefreshTokens.tenantId,
        familyId: customerAuthRefreshTokens.familyId,
        expiresAt: customerAuthRefreshTokens.expiresAt,
        revokedAt: customerAuthRefreshTokens.revokedAt,
      })
      .from(customerAuthRefreshTokens)
      .where(eq(customerAuthRefreshTokens.tokenHash, tokenHash))
      .limit(1);

    return rows[0] ?? null;
  }

  async revokeCustomerRefreshToken({
    tokenId,
    tenantId,
    replacedByTokenId,
  }: {
    tokenId: string;
    tenantId: string;
    replacedByTokenId?: string;
  }): Promise<void> {
    await this.db
      .update(customerAuthRefreshTokens)
      .set({
        revokedAt: new Date(),
        replacedByTokenId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customerAuthRefreshTokens.tenantId, tenantId),
          eq(customerAuthRefreshTokens.id, tokenId),
        ),
      );
  }

  async revokeCustomerRefreshTokenFamily(input: {
    tenantId: string;
    familyId: string;
  }): Promise<void> {
    await this.db
      .update(customerAuthRefreshTokens)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customerAuthRefreshTokens.tenantId, input.tenantId),
          eq(customerAuthRefreshTokens.familyId, input.familyId),
        ),
      );
  }

  async revokeCustomerRefreshTokenByHash(input: {
    tenantId: string;
    tokenHash: string;
  }): Promise<void> {
    await this.db
      .update(customerAuthRefreshTokens)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customerAuthRefreshTokens.tenantId, input.tenantId),
          eq(customerAuthRefreshTokens.tokenHash, input.tokenHash),
        ),
      );
  }

  async findStaffLoginUser({
    identifier,
    tenantId,
  }: {
    identifier: string;
    tenantId: string;
  }): Promise<MobileStaffUser | null> {
    const normalizedIdentifier = identifier.trim().toLowerCase();

    const rows = await this.db
      .select({
        ...getTableColumns(users),
      })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.userType, "tenant"),
          or(
            eq(users.normalizedEmail, normalizedIdentifier),
            eq(users.phone, identifier.trim()),
          ),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async findStaffUserById(input: {
    tenantId: string;
    userId: string;
  }): Promise<MobileStaffUser | null> {
    const rows = await this.db
      .select({
        ...getTableColumns(users),
      })
      .from(users)
      .where(
        and(
          eq(users.tenantId, input.tenantId),
          eq(users.id, input.userId),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async getStaffAccess(input: {
    tenantId: string;
    userId: string;
  }): Promise<UserAccess> {
    const rows = await this.db
      .select({
        roleCode: roles.code,
        permissionCode: permissions.code,
        branchId: userRoles.branchId,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(
        rolePermissions,
        and(
          eq(rolePermissions.tenantId, input.tenantId),
          eq(rolePermissions.roleId, roles.id),
        ),
      )
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userRoles.tenantId, input.tenantId),
          eq(userRoles.userId, input.userId),
          eq(roles.tenantId, input.tenantId),
          isNull(userRoles.revokedAt),
          eq(roles.scope, "tenant"),
          eq(roles.status, "active"),
          isNull(roles.deletedAt),
        ),
      );

    const profileRows = await this.db
      .select({ displayName: userProfiles.displayName })
      .from(userProfiles)
      .where(
        and(
          eq(userProfiles.tenantId, input.tenantId),
          eq(userProfiles.userId, input.userId),
        ),
      )
      .limit(1);

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
      displayName: profileRows[0]?.displayName ?? input.userId,
    };
  }

  async updateStaffLastLoginAt(input: {
    tenantId: string;
    userId: string;
  }): Promise<void> {
    await this.db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(users.tenantId, input.tenantId), eq(users.id, input.userId)),
      );
  }

  async createStaffRefreshToken({
    userId,
    tenantId,
    tokenHash,
    familyId,
    expiresAt,
    meta,
  }: {
    userId: string;
    tenantId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    meta?: AuthRequestMeta;
  }): Promise<string> {
    const rows = await this.db
      .insert(authRefreshTokens)
      .values({
        id: createId(),
        userId,
        tenantId,
        tokenHash,
        familyId,
        expiresAt,
        deviceId: meta?.deviceId,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      })
      .returning({ id: authRefreshTokens.id });

    return rows[0]?.id ?? "";
  }

  async findStaffRefreshTokenByHash(
    tokenHash: string,
  ): Promise<MobileStoredRefreshToken | null> {
    const rows = await this.db
      .select({
        id: authRefreshTokens.id,
        subjectId: authRefreshTokens.userId,
        tenantId: authRefreshTokens.tenantId,
        familyId: authRefreshTokens.familyId,
        expiresAt: authRefreshTokens.expiresAt,
        revokedAt: authRefreshTokens.revokedAt,
      })
      .from(authRefreshTokens)
      .where(eq(authRefreshTokens.tokenHash, tokenHash))
      .limit(1);

    const row = rows[0];

    if (!row?.tenantId) {
      return null;
    }

    return {
      ...row,
      tenantId: row.tenantId,
    };
  }

  async revokeStaffRefreshToken({
    tokenId,
    tenantId,
    replacedByTokenId,
  }: {
    tokenId: string;
    tenantId: string;
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
          eq(authRefreshTokens.tenantId, tenantId),
          eq(authRefreshTokens.id, tokenId),
        ),
      );
  }

  async revokeStaffRefreshTokenFamily(input: {
    tenantId: string;
    familyId: string;
  }): Promise<void> {
    await this.db
      .update(authRefreshTokens)
      .set({
        revokedAt: new Date(),
      })
      .where(
        and(
          eq(authRefreshTokens.tenantId, input.tenantId),
          eq(authRefreshTokens.familyId, input.familyId),
        ),
      );
  }

  async revokeStaffRefreshTokenByHash(input: {
    tenantId: string;
    tokenHash: string;
  }): Promise<void> {
    await this.db
      .update(authRefreshTokens)
      .set({
        revokedAt: new Date(),
      })
      .where(
        and(
          eq(authRefreshTokens.tenantId, input.tenantId),
          eq(authRefreshTokens.tokenHash, input.tokenHash),
        ),
      );
  }
}
