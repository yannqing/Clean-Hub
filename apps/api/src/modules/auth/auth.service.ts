import type { Database } from "@cleanhub/db";

import {
  getRefreshTokenTtlSeconds,
  resolveEffectiveSecurityPolicy,
} from "../saas/security/security-policy.js";
import { AuthError, invalidCredentials } from "./auth.errors.js";
import {
  AuthRepository,
  type PosTerminalLoginContext,
  type ValidatedUserAccess,
} from "./auth.repository.js";
import type {
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
import {
  isUserIdentityShapeValid,
  isWebRoleBranchScopeValid,
  resolveSessionPrimaryRole,
} from "./login-identity.helper.js";
import { verifyPassword } from "./password.service.js";
import {
  assertEnrolledTerminalCredential,
  buildPosPinLockKeys,
} from "./pos-terminal-credential.js";
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

async function assertLockKeysNotLocked(
  db: Database,
  lockKeys: readonly string[],
): Promise<void> {
  for (const lockKey of lockKeys) {
    await assertLoginNotLocked(db, lockKey);
  }
}

async function recordFailureForLockKeys(
  db: Database,
  lockKeys: readonly string[],
  policy: Awaited<ReturnType<typeof resolveEffectiveSecurityPolicy>>,
): Promise<void> {
  let lockError: AuthError | undefined;

  for (const lockKey of lockKeys) {
    try {
      await recordLoginFailure(db, lockKey, policy);
    } catch (error) {
      if (error instanceof AuthError && error.code === "ACCOUNT_LOCKED") {
        lockError = error;
        continue;
      }
      throw error;
    }
  }

  if (lockError) {
    throw lockError;
  }
}

async function clearLockKeys(
  db: Database,
  lockKeys: readonly string[],
): Promise<void> {
  for (const lockKey of lockKeys) {
    await clearLoginLockout(db, lockKey);
  }
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
      terminal?: PosTerminalLoginContext;
    },
  ): Promise<AuthResult> {
    const access = await this.repository.getUserAccess(
      user,
      input.terminal ? "pos" : "web",
    );
    const authContextBase = this.buildAuthContextBase(
      user,
      access,
      input.terminal,
    );
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
      terminalId: input.terminal?.id,
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
    const lockKey = buildLoginLockKey(normalizedIdentifier);
    const policy = await resolveEffectiveSecurityPolicy(this.db);

    await assertLoginNotLocked(this.db, lockKey);

    const user = await this.repository.findLoginUser(normalizedIdentifier);

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

    try {
      assertActiveUser(user);
      await this.assertUserIdentityAvailable(user, false);
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
    const policy = await resolveEffectiveSecurityPolicy(this.db);

    const terminalContext = await this.repository.findPosTerminalLoginContext({
      tenantCode,
      deviceId,
    });
    const lockKeys = buildPosPinLockKeys({
      tenantId: terminalContext?.tenantId ?? `code:${tenantCode.toLowerCase()}`,
      terminalId: terminalContext?.id,
      ipAddress: input.ipAddress,
    });
    const meta: AuthRequestMeta = terminalContext
      ? {
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          deviceId: terminalContext.deviceId,
        }
      : buildRequestMeta(input);

    await assertLockKeysNotLocked(this.db, lockKeys);

    try {
      assertEnrolledTerminalCredential(
        terminalContext,
        input.terminalCredential,
      );
    } catch (error) {
      if (
        error instanceof AuthError &&
        error.code !== "POS_TERMINAL_DISABLED"
      ) {
        try {
          await recordFailureForLockKeys(this.db, lockKeys, policy);
        } catch (lockError) {
          if (
            lockError instanceof AuthError &&
            lockError.code === "ACCOUNT_LOCKED"
          ) {
            await this.repository.writeAuditLog({
              tenantId: terminalContext?.tenantId,
              eventType: "auth.pos_pin_login.failed",
              success: false,
              reason: lockError.code,
              meta,
              metadata: {
                tenantCode,
                deviceId,
                terminalId: terminalContext?.id,
                branchId: terminalContext?.branchId,
              },
            });
          }
          throw lockError;
        }
      }

      await this.repository.writeAuditLog({
        tenantId: terminalContext?.tenantId,
        eventType: "auth.pos_pin_login.failed",
        success: false,
        reason: error instanceof AuthError ? error.code : "terminal_invalid",
        meta,
        metadata: {
          tenantCode,
          deviceId,
          terminalId: terminalContext?.id,
          branchId: terminalContext?.branchId,
        },
      });
      throw error;
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
        await recordFailureForLockKeys(this.db, lockKeys, policy);
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
              terminalId: terminalContext.id,
              branchId: terminalContext.branchId,
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
          terminalId: terminalContext.id,
          branchId: terminalContext.branchId,
        },
      });
      throw invalidCredentials();
    }

    const user = matchedUsers[0]!;

    try {
      assertActiveUser(user);
      await clearLockKeys(this.db, lockKeys);
      await this.repository.markPosTerminalCredentialUsed(terminalContext.id);

      return this.issueAuthResult(user, {
        eventType: "auth.pos_pin_login.success",
        meta,
        terminal: terminalContext,
        metadata: {
          tenantCode,
          deviceId,
          terminalId: terminalContext.id,
          branchId: terminalContext.branchId,
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
            terminalId: terminalContext.id,
            branchId: terminalContext.branchId,
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
    await this.assertUserIdentityAvailable(user, true);

    if (storedToken.tenantId !== user.tenantId) {
      await this.repository.revokeRefreshTokenFamily(storedToken.familyId);
      throw new AuthError(
        "TOKEN_INVALID",
        "Refresh token tenant no longer matches the user account.",
      );
    }

    const terminal = storedToken.terminalId
      ? (await this.repository.findPosTerminalById(storedToken.terminalId)) ??
        undefined
      : undefined;
    const access = await this.repository.getUserAccess(
      user,
      terminal ? "pos" : "web",
    );

    if (
      storedToken.terminalId &&
      (!terminal ||
        terminal.tenantId !== storedToken.tenantId ||
        terminal.deviceId !== storedToken.deviceId)
    ) {
      await this.repository.revokeRefreshTokenFamily(storedToken.familyId);
      throw new AuthError(
        "POS_TERMINAL_DISABLED",
        "The POS terminal session is no longer active.",
      );
    }

    if (terminal) {
      assertEnrolledTerminalCredential(
        terminal,
        input.terminalCredential,
      );
    }

    const authContextBase = this.buildAuthContextBase(user, access, terminal);
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
      terminalId: terminal?.id,
      meta: terminal
        ? { ...input, deviceId: terminal.deviceId }
        : input,
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
    await this.assertUserIdentityAvailable(user, true);

    if (claims.tenantId !== user.tenantId) {
      throw new AuthError(
        "TOKEN_INVALID",
        "Access token tenant no longer matches the user account.",
      );
    }

    const terminal = claims.terminalId
      ? (await this.repository.findPosTerminalById(claims.terminalId)) ??
        undefined
      : undefined;
    const access = await this.repository.getUserAccess(
      user,
      terminal ? "pos" : "web",
    );

    if (
      claims.terminalId &&
      (!terminal ||
        terminal.status !== "active" ||
        !terminal.credentialDigest ||
        terminal.tenantId !== user.tenantId ||
        terminal.branchId !== claims.terminalBranchId ||
        terminal.deviceId !== claims.terminalDeviceId)
    ) {
      throw new AuthError(
        "POS_TERMINAL_DISABLED",
        "The POS terminal session is no longer active.",
      );
    }

    return this.withAccessTokenExpiresAt(
      this.buildAuthContextBase(user, access, terminal),
      claims.expiresAt,
    );
  }

  private buildAuthContextBase(
    user: AuthenticatedUser,
    access: ValidatedUserAccess,
    terminal?: PosTerminalLoginContext,
  ): Omit<AuthContext, "accessTokenExpiresAt"> {
    if (!access.identityConsistent) {
      throw invalidCredentials();
    }

    const role = resolveSessionPrimaryRole(
      user,
      access.roles,
      terminal ? "pos" : "web",
    );

    if (!role) {
      throw invalidCredentials();
    }

    if (!terminal && !isWebRoleBranchScopeValid(role, access.branchIds)) {
      throw invalidCredentials();
    }

    if (
      terminal &&
      role !== "owner" &&
      !access.branchIds.includes(terminal.branchId)
    ) {
      throw new AuthError(
        "FORBIDDEN",
        "The staff member is not assigned to the terminal branch.",
      );
    }

    const context: Omit<AuthContext, "accessTokenExpiresAt"> = {
      userId: user.id,
      displayName: access.displayName,
      tenantId: user.tenantId,
      branchIds: terminal ? [terminal.branchId] : access.branchIds,
      role,
      roles: access.roles,
      permissions: access.permissions,
    };

    if (terminal) {
      context.terminalId = terminal.id;
      context.terminalBranchId = terminal.branchId;
      context.terminalDeviceId = terminal.deviceId;
    }

    return context;
  }

  private async assertUserIdentityAvailable(
    user: AuthenticatedUser,
    tokenSession: boolean,
  ): Promise<void> {
    const invalidIdentity = () => {
      if (tokenSession) {
        return new AuthError(
          "TOKEN_INVALID",
          "Authenticated user identity is no longer available.",
        );
      }

      return invalidCredentials();
    };

    if (!isUserIdentityShapeValid(user)) {
      throw invalidIdentity();
    }

    if (
      user.userType === "tenant" &&
      (!user.tenantId || !(await this.repository.isTenantActive(user.tenantId)))
    ) {
      throw invalidIdentity();
    }
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
