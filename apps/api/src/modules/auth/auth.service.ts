import type { Database } from "@cleanhub/db";

import {
  getRefreshTokenTtlSeconds,
  resolveEffectiveSecurityPolicy,
} from "../saas/security/security-policy.js";
import { AuthError, invalidCredentials } from "./auth.errors.js";
import { AuthRepository } from "./auth.repository.js";
import type {
  AdminRole,
  AuthContext,
  AuthRequestMeta,
  AuthResult,
  AuthServiceOptions,
  AuthenticatedUser,
  LoginInput,
  LogoutInput,
  PosPinLoginInput,
  RefreshInput,
  RefreshResult,
  UserAccess,
} from "./auth.types.js";
import {
  createAuthCookieHeaders,
  createClearAuthCookieHeaders,
} from "./cookie.service.js";
import {
  assertLoginNotLocked,
  buildLoginLockKey,
  clearLoginLockout,
  recordLoginFailure,
} from "./login-lockout.helper.js";
import { verifyPassword } from "./password.service.js";
import { hashOpaqueToken, TokenService } from "./token.service.js";

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function buildRequestMeta(input: LoginInput | PosPinLoginInput): AuthRequestMeta {
  return {
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    deviceId: input.deviceId,
  };
}

function assertActiveUser(user: AuthenticatedUser): void {
  if (user.status === "disabled") {
    throw new AuthError("USER_DISABLED", "User is disabled.");
  }

  if (user.status === "suspended") {
    throw new AuthError("USER_SUSPENDED", "User is suspended.");
  }

  if (user.status !== "active") {
    throw invalidCredentials();
  }
}

function resolvePrimaryRole(user: AuthenticatedUser, access: UserAccess): AdminRole {
  const rolePriority: AdminRole[] =
    user.userType === "saas"
      ? ["super_admin", "support"]
      : ["owner", "manager", "cashier"];

  const role = rolePriority.find((candidate) =>
    access.roles.includes(candidate),
  );

  if (!role) {
    throw invalidCredentials();
  }

  return role;
}

export class AuthService {
  private readonly db: Database;
  private readonly repository: AuthRepository;
  private readonly tokenService: TokenService;
  private readonly cookieSecure: boolean;
  private readonly envRefreshTokenTtlSeconds: number;

  constructor({
    db,
    accessTokenSecret,
    cookieSecure = process.env.NODE_ENV === "production",
    accessTokenTtlSeconds,
    refreshTokenTtlSeconds,
  }: AuthServiceOptions) {
    this.db = db;
    this.repository = new AuthRepository(db);
    this.envRefreshTokenTtlSeconds =
      refreshTokenTtlSeconds ?? 30 * 24 * 60 * 60;
    this.tokenService = new TokenService({
      secret: accessTokenSecret,
      accessTokenTtlSeconds,
      refreshTokenTtlSeconds: this.envRefreshTokenTtlSeconds,
    });
    this.cookieSecure = cookieSecure;
  }

  private async getRefreshTokenTtlSeconds(): Promise<number> {
    const policy = await resolveEffectiveSecurityPolicy(this.db);

    return getRefreshTokenTtlSeconds(policy);
  }

  private async issueAuthResult(
    user: AuthenticatedUser,
    input: {
      eventType: string;
      meta?: AuthRequestMeta;
      metadata?: Record<string, unknown>;
    },
  ): Promise<AuthResult> {
    const access = await this.repository.getUserAccess(user.id);
    const authContextBase = this.buildAuthContextBase(user, access);
    const refreshTokenTtlSeconds = await this.getRefreshTokenTtlSeconds();
    const tokens = await this.tokenService.issueTokenPair(authContextBase, {
      refreshTokenTtlSeconds,
    });
    const authContext = this.withAccessTokenExpiresAt(
      authContextBase,
      tokens.accessTokenExpiresAt,
    );
    const refreshTokenId = await this.repository.createRefreshToken({
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash: hashOpaqueToken(tokens.refreshToken),
      familyId: tokens.refreshTokenFamilyId,
      expiresAt: tokens.refreshTokenExpiresAt,
      meta: input.meta,
    });

    if (!refreshTokenId) {
      throw new AuthError("TOKEN_INVALID", "Failed to create refresh token.");
    }

    await this.repository.updateLastLoginAt(user.id);
    await this.repository.writeAuditLog({
      tenantId: user.tenantId,
      actorUserId: user.id,
      eventType: input.eventType,
      success: true,
      meta: input.meta,
      metadata: input.metadata,
    });

    return {
      authContext,
      tokens,
      setCookieHeaders: createAuthCookieHeaders(tokens, {
        secure: this.cookieSecure,
      }),
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const normalizedIdentifier = normalizeIdentifier(input.identifier);
    const lockKey = buildLoginLockKey(normalizedIdentifier, input.tenantCode);
    const policy = await resolveEffectiveSecurityPolicy(this.db);

    await assertLoginNotLocked(this.db, lockKey);

    const user = await this.repository.findLoginUser({
      identifier: normalizedIdentifier,
      tenantCode: input.tenantCode,
    });

    if (!user) {
      try {
        await recordLoginFailure(this.db, lockKey, policy);
      } catch (error) {
        if (error instanceof AuthError && error.code === "ACCOUNT_LOCKED") {
          await this.repository.writeAuditLog({
            eventType: "auth.login.failed",
            success: false,
            reason: error.code,
            meta: input,
            metadata: { identifier: normalizedIdentifier },
          });
        }

        throw error;
      }

      await this.repository.writeAuditLog({
        eventType: "auth.login.failed",
        success: false,
        reason: "invalid_credentials",
        meta: input,
        metadata: { identifier: normalizedIdentifier },
      });
      throw invalidCredentials();
    }

    if (user.tenantId && !input.tenantCode?.trim()) {
      throw new AuthError(
        "TENANT_CODE_REQUIRED",
        "Pressing code is required for store administrators.",
      );
    }

    try {
      assertActiveUser(user);
      const passwordValid = await verifyPassword(input.password, user.passwordHash);

      if (!passwordValid) {
        try {
          await recordLoginFailure(this.db, lockKey, policy);
        } catch (error) {
          if (error instanceof AuthError && error.code === "ACCOUNT_LOCKED") {
            await this.repository.writeAuditLog({
              tenantId: user.tenantId,
              actorUserId: user.id,
              eventType: "auth.login.failed",
              success: false,
              reason: error.code,
              meta: input,
            });
          }

          throw error;
        }

        throw invalidCredentials();
      }

      await clearLoginLockout(this.db, lockKey);

      return this.issueAuthResult(user, {
        eventType: "auth.login.success",
        meta: buildRequestMeta(input),
      });
    } catch (error) {
      if (error instanceof AuthError && error.code === "INVALID_CREDENTIALS") {
        await this.repository.writeAuditLog({
          tenantId: user.tenantId,
          actorUserId: user.id,
          eventType: "auth.login.failed",
          success: false,
          reason: error.code,
          meta: input,
        });
      } else if (error instanceof AuthError) {
        await this.repository.writeAuditLog({
          tenantId: user.tenantId,
          actorUserId: user.id,
          eventType: "auth.login.failed",
          success: false,
          reason: error.code,
          meta: input,
        });
      }

      throw error;
    }
  }

  async loginWithPosPin(input: PosPinLoginInput): Promise<AuthResult> {
    const tenantCode = input.tenantCode.trim();
    const deviceId = input.deviceId.trim();
    const lockKey = buildLoginLockKey(`pos-pin:${deviceId}`, tenantCode);
    const policy = await resolveEffectiveSecurityPolicy(this.db);
    const meta = buildRequestMeta(input);

    await assertLoginNotLocked(this.db, lockKey);

    const terminalContext = await this.repository.findPosTerminalLoginContext({
      tenantCode,
      deviceId,
    });

    if (!terminalContext) {
      try {
        await recordLoginFailure(this.db, lockKey, policy);
      } catch (error) {
        if (error instanceof AuthError && error.code === "ACCOUNT_LOCKED") {
          await this.repository.writeAuditLog({
            eventType: "auth.pos_pin_login.failed",
            success: false,
            reason: error.code,
            meta,
            metadata: { tenantCode, deviceId },
          });
        }

        throw error;
      }

      await this.repository.writeAuditLog({
        eventType: "auth.pos_pin_login.failed",
        success: false,
        reason: "invalid_tenant_or_terminal",
        meta,
        metadata: { tenantCode, deviceId },
      });
      throw invalidCredentials();
    }

    if (terminalContext.deviceRegistered && terminalContext.status !== "active") {
      await this.repository.writeAuditLog({
        tenantId: terminalContext.tenantId,
        eventType: "auth.pos_pin_login.failed",
        success: false,
        reason: "terminal_inactive",
        meta,
        metadata: {
          tenantCode,
          deviceId,
          branchId: terminalContext.branchId,
        },
      });
      throw new AuthError("FORBIDDEN", "POS terminal is inactive.");
    }

    const candidates = await this.repository.findPosPinLoginCandidates({
      tenantId: terminalContext.tenantId,
      branchId: terminalContext.branchId,
    });
    const matchedUsers: AuthenticatedUser[] = [];

    for (const candidate of candidates) {
      if (await verifyPassword(input.pin, candidate.pinHash)) {
        matchedUsers.push(candidate);
      }
    }

    if (matchedUsers.length !== 1) {
      try {
        await recordLoginFailure(this.db, lockKey, policy);
      } catch (error) {
        if (error instanceof AuthError && error.code === "ACCOUNT_LOCKED") {
          await this.repository.writeAuditLog({
            tenantId: terminalContext.tenantId,
            eventType: "auth.pos_pin_login.failed",
            success: false,
            reason: error.code,
            meta,
            metadata: {
              tenantCode,
              deviceId,
              branchId: terminalContext.branchId,
              terminalRegistered: terminalContext.deviceRegistered,
            },
          });
        }

        throw error;
      }

      await this.repository.writeAuditLog({
        tenantId: terminalContext.tenantId,
        eventType: "auth.pos_pin_login.failed",
        success: false,
        reason: matchedUsers.length > 1 ? "pin_ambiguous" : "invalid_credentials",
        meta,
        metadata: {
          tenantCode,
          deviceId,
          branchId: terminalContext.branchId,
          terminalRegistered: terminalContext.deviceRegistered,
        },
      });
      throw invalidCredentials();
    }

    const user = matchedUsers[0]!;

    try {
      assertActiveUser(user);
      await clearLoginLockout(this.db, lockKey);

      return this.issueAuthResult(user, {
        eventType: "auth.pos_pin_login.success",
        meta,
        metadata: {
          tenantCode,
          deviceId,
          branchId: terminalContext.branchId,
          terminalRegistered: terminalContext.deviceRegistered,
        },
      });
    } catch (error) {
      if (error instanceof AuthError) {
        await this.repository.writeAuditLog({
          tenantId: user.tenantId,
          actorUserId: user.id,
          eventType: "auth.pos_pin_login.failed",
          success: false,
          reason: error.code,
          meta,
          metadata: {
            tenantCode,
            deviceId,
            branchId: terminalContext.branchId,
            terminalRegistered: terminalContext.deviceRegistered,
          },
        });
      }

      throw error;
    }
  }

  async refresh(input: RefreshInput): Promise<RefreshResult> {
    const tokenHash = hashOpaqueToken(input.refreshToken);
    const storedToken = await this.repository.findRefreshTokenByHash(tokenHash);

    if (!storedToken) {
      throw new AuthError("TOKEN_INVALID", "Refresh token is invalid.");
    }

    if (storedToken.revokedAt) {
      await this.repository.revokeRefreshTokenFamily(storedToken.familyId);
      await this.repository.writeAuditLog({
        tenantId: storedToken.tenantId,
        actorUserId: storedToken.userId,
        eventType: "auth.refresh.reuse_detected",
        success: false,
        reason: "refresh_token_reuse",
        meta: input,
      });
      throw new AuthError(
        "TOKEN_REUSE_DETECTED",
        "Refresh token reuse detected.",
      );
    }

    if (storedToken.expiresAt.getTime() <= Date.now()) {
      await this.repository.revokeRefreshToken({ tokenId: storedToken.id });
      throw new AuthError("TOKEN_EXPIRED", "Refresh token has expired.");
    }

    const user = await this.repository.findUserById(storedToken.userId);

    if (!user) {
      throw new AuthError("TOKEN_INVALID", "Refresh token user is invalid.");
    }

    assertActiveUser(user);

    const access = await this.repository.getUserAccess(user.id);
    const authContextBase = this.buildAuthContextBase(user, access);
    const refreshTokenTtlSeconds = await this.getRefreshTokenTtlSeconds();
    const issuedTokens = await this.tokenService.issueTokenPair(authContextBase, {
      refreshTokenTtlSeconds,
    });
    const tokens = {
      ...issuedTokens,
      refreshTokenFamilyId: storedToken.familyId,
    };
    const authContext = this.withAccessTokenExpiresAt(
      authContextBase,
      tokens.accessTokenExpiresAt,
    );
    const newRefreshTokenId = await this.repository.createRefreshToken({
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash: hashOpaqueToken(tokens.refreshToken),
      familyId: storedToken.familyId,
      expiresAt: tokens.refreshTokenExpiresAt,
      meta: input,
    });

    await this.repository.revokeRefreshToken({
      tokenId: storedToken.id,
      replacedByTokenId: newRefreshTokenId,
    });

    return {
      authContext,
      tokens,
      setCookieHeaders: createAuthCookieHeaders(tokens, {
        secure: this.cookieSecure,
      }),
    };
  }

  async logout(input: LogoutInput): Promise<string[]> {
    if (input.refreshToken) {
      const tokenHash = hashOpaqueToken(input.refreshToken);
      const storedToken = await this.repository.findRefreshTokenByHash(tokenHash);

      await this.repository.revokeRefreshTokenByRawHash(tokenHash);

      await this.repository.writeAuditLog({
        tenantId: storedToken?.tenantId,
        actorUserId: storedToken?.userId,
        eventType: "auth.logout",
        success: true,
        meta: input,
      });
    }

    return createClearAuthCookieHeaders({ secure: this.cookieSecure });
  }

  async getAuthContext(accessToken: string): Promise<AuthContext> {
    const claims = await this.tokenService.verifyAccessToken(accessToken);

    if (!claims.sub) {
      throw new AuthError("TOKEN_INVALID", "Access token subject is missing.");
    }

    const user = await this.repository.findUserById(claims.sub);

    if (!user) {
      throw new AuthError("TOKEN_INVALID", "Access token user is invalid.");
    }

    assertActiveUser(user);

    const access = await this.repository.getUserAccess(user.id);
    return this.withAccessTokenExpiresAt(
      this.buildAuthContextBase(user, access),
      claims.expiresAt,
    );
  }

  private buildAuthContextBase(
    user: AuthenticatedUser,
    access: UserAccess,
  ): Omit<AuthContext, "accessTokenExpiresAt"> {
    return {
      userId: user.id,
      displayName: access.displayName,
      tenantId: user.tenantId,
      branchIds: access.branchIds,
      role: resolvePrimaryRole(user, access),
      roles: access.roles,
      permissions: access.permissions,
    };
  }

  private withAccessTokenExpiresAt(
    context: Omit<AuthContext, "accessTokenExpiresAt">,
    expiresAt: Date,
  ): AuthContext {
    return {
      ...context,
      accessTokenExpiresAt: expiresAt.toISOString(),
    };
  }
}
