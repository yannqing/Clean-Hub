import { createHmac } from "node:crypto";

import type { Database } from "@cleanhub/db";

import {
  getRefreshTokenTtlSeconds,
  resolveEffectiveSecurityPolicy,
} from "../saas/security/security-policy.js";
import { AuthError, invalidCredentials } from "./auth.errors.js";
import {
  AuthRepository,
  lockPosPinAttempt,
  type PosBootstrapTerminalRecord,
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
  PosBootstrapInput,
  PosBootstrapState,
  PosPinLoginInput,
  RefreshInput,
  RefreshResult,
} from "./auth.types.js";
import {
  createAuthCookieHeaders,
  createClearAuthCookieHeaders,
  resolveAuthCookieSecure,
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
  hashTerminalCredential,
} from "./pos-terminal-credential.js";
import { resolvePosBootstrapState } from "./pos-bootstrap-state.js";
import { hashOpaqueToken, TokenService } from "./token.service.js";

const REFRESH_TOKEN_ROTATION_GRACE_MS = 10_000;

function deriveRefreshTokenSuccessor(
  secret: string,
  predecessorTokenHash: string,
  familyId: string,
): string {
  return createHmac("sha384", secret)
    .update("cleanhub-refresh-successor-v1")
    .update("\0")
    .update(familyId)
    .update("\0")
    .update(predecessorTokenHash)
    .digest("base64url");
}

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function toEffectiveTerminalContext(
  terminal: PosBootstrapTerminalRecord,
): PosTerminalLoginContext {
  return {
    id: terminal.id,
    tenantId: terminal.tenantId,
    branchId: terminal.branchId,
    deviceId: terminal.deviceId,
    status:
      terminal.status === "active" &&
      terminal.tenantStatus === "active" &&
      !terminal.tenantDeleted &&
      terminal.branchStatus === "active" &&
      !terminal.branchDeleted
        ? "active"
        : "inactive",
    credentialDigest: terminal.credentialDigest,
    credentialVersion: terminal.credentialVersion,
  };
}

function requireUnchangedPosTerminal(
  terminal: PosTerminalLoginContext | null,
  expected: PosTerminalLoginContext,
  terminalCredential: string | undefined,
): PosTerminalLoginContext {
  if (!terminal) {
    throw new AuthError(
      "POS_TERMINAL_DISABLED",
      "The POS terminal session is no longer active.",
    );
  }

  assertEnrolledTerminalCredential(terminal, terminalCredential);

  if (
    terminal.tenantId !== expected.tenantId ||
    terminal.branchId !== expected.branchId ||
    terminal.deviceId !== expected.deviceId ||
    terminal.credentialDigest !== expected.credentialDigest ||
    terminal.credentialVersion !== expected.credentialVersion
  ) {
    throw new AuthError(
      "POS_TERMINAL_CREDENTIAL_INVALID",
      "The POS terminal changed while signing in. Try again.",
    );
  }

  return terminal;
}

function buildRequestMeta(
  input: LoginInput | PosPinLoginInput,
): AuthRequestMeta {
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

function laterAccountLockError(
  current: AuthError | undefined,
  candidate: AuthError,
): AuthError {
  if (!current) {
    return candidate;
  }

  const currentTime = current.lockedUntil?.getTime() ?? 0;
  const candidateTime = candidate.lockedUntil?.getTime() ?? 0;

  return candidateTime > currentTime ? candidate : current;
}

async function assertLockKeysNotLocked(
  db: Database,
  lockKeys: readonly string[],
): Promise<void> {
  let lockError: AuthError | undefined;

  for (const lockKey of lockKeys) {
    try {
      await assertLoginNotLocked(db, lockKey);
    } catch (error) {
      if (error instanceof AuthError && error.code === "ACCOUNT_LOCKED") {
        lockError = laterAccountLockError(lockError, error);
        continue;
      }
      throw error;
    }
  }

  if (lockError) {
    throw lockError;
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
        lockError = laterAccountLockError(lockError, error);
        continue;
      }
      throw error;
    }
  }

  if (lockError) {
    throw lockError;
  }
}

export class AuthService {
  private readonly db: Database;
  private readonly repository: AuthRepository;
  private readonly tokenService: TokenService;
  private readonly cookieSecure: boolean;
  private readonly envRefreshTokenTtlSeconds: number;
  private readonly refreshTokenRotationSecret: string;

  constructor({
    db,
    accessTokenSecret,
    cookieSecure = resolveAuthCookieSecure(),
    accessTokenTtlSeconds,
    refreshTokenTtlSeconds,
  }: AuthServiceOptions) {
    this.db = db;
    this.repository = new AuthRepository(db);
    this.envRefreshTokenTtlSeconds =
      refreshTokenTtlSeconds ?? 30 * 24 * 60 * 60;
    this.refreshTokenRotationSecret = accessTokenSecret;
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

  private async issuePosAuthResult(
    repository: AuthRepository,
    user: AuthenticatedUser,
    input: {
      eventType: string;
      meta: AuthRequestMeta;
      metadata: Record<string, unknown>;
      terminal: PosTerminalLoginContext;
      refreshTokenTtlSeconds: number;
    },
  ): Promise<AuthResult> {
    const terminal = input.terminal;
    const currentUser = await repository.findUserById(user.id);
    if (!currentUser || currentUser.tenantId !== terminal.tenantId) {
      throw new AuthError(
        "TOKEN_INVALID",
        "Authenticated user identity is no longer available.",
      );
    }

    assertActiveUser(currentUser);
    await this.assertUserIdentityAvailable(currentUser, true, repository);

    const access = await repository.getUserAccess(currentUser, "pos");
    const authContextBase = this.buildAuthContextBase(
      currentUser,
      access,
      terminal,
    );
    const tokens = await this.tokenService.issueTokenPair(authContextBase, {
      refreshTokenTtlSeconds: input.refreshTokenTtlSeconds,
    });
    const authContext = this.withAccessTokenExpiresAt(
      authContextBase,
      tokens.accessTokenExpiresAt,
    );
    const refreshTokenId = await repository.createRefreshToken({
      userId: currentUser.id,
      tenantId: currentUser.tenantId,
      tokenHash: hashOpaqueToken(tokens.refreshToken),
      familyId: tokens.refreshTokenFamilyId,
      expiresAt: tokens.refreshTokenExpiresAt,
      terminalId: terminal.id,
      meta: {
        ...input.meta,
        deviceId: terminal.deviceId,
      },
    });

    if (!refreshTokenId) {
      throw new AuthError("TOKEN_INVALID", "Failed to create refresh token.");
    }

    await repository.markPosTerminalCredentialUsed(terminal.id);
    await repository.updateLastLoginAt(currentUser.id);
    await repository.writeAuditLog({
      tenantId: currentUser.tenantId,
      actorUserId: currentUser.id,
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
      const passwordValid = await verifyPassword(
        input.password,
        user.passwordHash,
      );

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

  async getPosBootstrapState(
    input: PosBootstrapInput,
  ): Promise<PosBootstrapState> {
    let authContext: AuthContext | null = null;

    if (input.accessToken) {
      try {
        authContext = await this.getAuthContext(input.accessToken);
      } catch (error) {
        if (!(error instanceof AuthError)) {
          throw error;
        }
      }
    }

    const credentialDigest = input.terminalCredential
      ? hashTerminalCredential(input.terminalCredential)
      : null;
    const credentialTerminal = credentialDigest
      ? await this.repository.findPosBootstrapTerminalByCredential({
          deviceId: input.deviceId,
          credentialDigest,
        })
      : null;
    const setupTenantId =
      authContext?.tenantId &&
      !authContext.terminalId &&
      (authContext.role === "owner" || authContext.role === "manager")
        ? authContext.tenantId
        : null;
    const [adminTerminal, adminTenant] = setupTenantId
      ? await Promise.all([
          this.repository.findPosBootstrapTerminalByTenantAndDevice({
            tenantId: setupTenantId,
            deviceId: input.deviceId,
          }),
          this.repository.findPosBootstrapTenant(setupTenantId),
        ])
      : [null, null];

    return resolvePosBootstrapState({
      deviceId: input.deviceId,
      authContext,
      credentialPresented: Boolean(input.terminalCredential),
      credentialTerminal,
      adminTerminal,
      adminTenant,
    });
  }

  async loginWithPosPin(input: PosPinLoginInput): Promise<AuthResult> {
    const deviceId = input.deviceId.trim();
    const policy = await resolveEffectiveSecurityPolicy(this.db);

    const credentialTerminal = input.terminalCredential
      ? await this.repository.findPosBootstrapTerminalByCredential({
          deviceId,
          credentialDigest: hashTerminalCredential(input.terminalCredential),
        })
      : null;
    const terminalContext = credentialTerminal
      ? toEffectiveTerminalContext(credentialTerminal)
      : null;
    const lockKeys = buildPosPinLockKeys({
      tenantId: terminalContext?.tenantId ?? "unresolved",
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
    const auditMetadata = {
      deviceId,
      terminalId: terminalContext?.id,
      branchId: terminalContext?.branchId,
    };

    await assertLockKeysNotLocked(this.db, lockKeys);

    if (!terminalContext) {
      let error = new AuthError(
        input.terminalCredential
          ? "POS_TERMINAL_CREDENTIAL_INVALID"
          : "POS_TERMINAL_ENROLLMENT_REQUIRED",
        input.terminalCredential
          ? "This POS terminal credential is invalid or expired."
          : "This POS terminal must be enrolled before PIN login.",
      );

      try {
        await recordFailureForLockKeys(this.db, lockKeys, policy);
      } catch (lockError) {
        if (!(lockError instanceof AuthError)) throw lockError;
        error = lockError;
      }
      await this.repository.writeAuditLog({
        eventType: "auth.pos_pin_login.failed",
        success: false,
        reason: error.code,
        meta,
        metadata: auditMetadata,
      });
      throw error;
    }

    const refreshTokenTtlSeconds = await this.getRefreshTokenTtlSeconds();
    let outcome:
      | { ok: true; result: AuthResult }
      | { ok: false; error: AuthError };
    try {
      outcome = await this.repository.runInTransaction(
        async (repository, tx) => {
          // Serialize PIN attempts with a transaction-scoped advisory lock.
          // Terminal lifecycle mutations intentionally do not take this lock,
          // so an emergency disable/revoke can overtake slow PIN hashing.
          await lockPosPinAttempt(tx, terminalContext.id);
          await assertLockKeysNotLocked(tx, lockKeys);

          let terminal: PosTerminalLoginContext | undefined;
          let terminalError: AuthError | undefined;

          try {
            terminal = requireUnchangedPosTerminal(
              await repository.findPosTerminalById(terminalContext.id),
              terminalContext,
              input.terminalCredential,
            );
          } catch (error) {
            if (!(error instanceof AuthError)) throw error;
            terminalError = error;
          }

          if (terminalError) {
            let effectiveError = terminalError;
            if (terminalError.code !== "POS_TERMINAL_DISABLED") {
              try {
                await recordFailureForLockKeys(tx, lockKeys, policy);
              } catch (lockError) {
                if (!(lockError instanceof AuthError)) throw lockError;
                effectiveError = lockError;
              }
            }

            await repository.writeAuditLog({
              tenantId: terminalContext.tenantId,
              eventType: "auth.pos_pin_login.failed",
              success: false,
              reason: effectiveError.code,
              meta,
              metadata: auditMetadata,
            });
            return { ok: false as const, error: effectiveError };
          }

          if (!terminal) {
            throw new AuthError(
              "POS_TERMINAL_DISABLED",
              "The POS terminal session is no longer active.",
            );
          }

          const candidates = await repository.findPosPinLoginCandidates({
            tenantId: terminal.tenantId,
            branchId: terminal.branchId,
          });
          const matchedUsers: AuthenticatedUser[] = [];

          for (const candidate of candidates) {
            if (await verifyPassword(input.pin, candidate.pinHash)) {
              matchedUsers.push(candidate);
            }
          }

          if (matchedUsers.length !== 1) {
            let error = invalidCredentials();
            try {
              await recordFailureForLockKeys(tx, lockKeys, policy);
            } catch (lockError) {
              if (!(lockError instanceof AuthError)) throw lockError;
              error = lockError;
            }

            await repository.writeAuditLog({
              tenantId: terminal.tenantId,
              eventType: "auth.pos_pin_login.failed",
              success: false,
              reason:
                error.code === "ACCOUNT_LOCKED"
                  ? error.code
                  : matchedUsers.length > 1
                    ? "pin_ambiguous"
                    : "invalid_credentials",
              meta,
              metadata: auditMetadata,
            });
            return { ok: false as const, error };
          }

          const user = matchedUsers[0]!;
          await repository.lockPosTerminalById(terminal.id);

          let signingTerminal: PosTerminalLoginContext;
          try {
            signingTerminal = requireUnchangedPosTerminal(
              await repository.findPosTerminalById(terminal.id),
              terminal,
              input.terminalCredential,
            );
          } catch (error) {
            if (!(error instanceof AuthError)) throw error;
            await repository.writeAuditLog({
              tenantId: terminal.tenantId,
              actorUserId: user.id,
              eventType: "auth.pos_pin_login.failed",
              success: false,
              reason: error.code,
              meta,
              metadata: auditMetadata,
            });
            return { ok: false as const, error };
          }

          try {
            const result = await this.issuePosAuthResult(repository, user, {
              eventType: "auth.pos_pin_login.success",
              meta,
              terminal: signingTerminal,
              refreshTokenTtlSeconds,
              metadata: auditMetadata,
            });
            return { ok: true as const, result };
          } catch (error) {
            if (!(error instanceof AuthError)) throw error;
            await repository.writeAuditLog({
              tenantId: user.tenantId,
              actorUserId: user.id,
              eventType: "auth.pos_pin_login.failed",
              success: false,
              reason: error.code,
              meta,
              metadata: auditMetadata,
            });
            return { ok: false as const, error };
          }
        },
      );
    } catch (error) {
      if (error instanceof AuthError) {
        await this.repository.writeAuditLog({
          tenantId: terminalContext.tenantId,
          eventType: "auth.pos_pin_login.failed",
          success: false,
          reason: error.code,
          meta,
          metadata: auditMetadata,
        });
      }

      throw error;
    }

    if (!outcome.ok) {
      throw outcome.error;
    }

    return outcome.result;
  }

  async refresh(input: RefreshInput): Promise<RefreshResult> {
    const tokenHash = hashOpaqueToken(input.refreshToken);
    const tokenHint = await this.repository.findRefreshTokenByHash(tokenHash);

    if (!tokenHint) {
      throw new AuthError("TOKEN_INVALID", "Refresh token is invalid.");
    }

    const refreshTokenTtlSeconds = await this.getRefreshTokenTtlSeconds();
    const outcome = await this.repository.runInTransaction(
      async (repository) => {
        // POS terminal lifecycle mutations lock the terminal before revoking
        // its refresh tokens. Refresh follows the same order so neither path
        // can insert a live successor after a disable/rebind/revoke commit.
        if (tokenHint.terminalId) {
          await repository.lockPosTerminalById(tokenHint.terminalId);
        }

        const storedToken =
          await repository.findRefreshTokenByHashForUpdate(tokenHash);

        if (!storedToken || storedToken.terminalId !== tokenHint.terminalId) {
          return {
            ok: false as const,
            error: new AuthError("TOKEN_INVALID", "Refresh token is invalid."),
          };
        }

        const now = Date.now();
        const isConcurrentRotationRetry =
          Boolean(storedToken.revokedAt) &&
          Boolean(storedToken.replacedByTokenId) &&
          now - storedToken.revokedAt!.getTime() >= 0 &&
          now - storedToken.revokedAt!.getTime() <=
            REFRESH_TOKEN_ROTATION_GRACE_MS;

        if (storedToken.revokedAt && !isConcurrentRotationRetry) {
          await repository.revokeRefreshTokenFamily(storedToken.familyId);
          await repository.writeAuditLog({
            tenantId: storedToken.tenantId,
            actorUserId: storedToken.userId,
            eventType: "auth.refresh.reuse_detected",
            success: false,
            reason: "refresh_token_reuse",
            meta: input,
          });
          return {
            ok: false as const,
            error: new AuthError(
              "TOKEN_REUSE_DETECTED",
              "Refresh token reuse detected.",
            ),
          };
        }

        if (storedToken.expiresAt.getTime() <= now) {
          await repository.revokeRefreshToken({
            tokenId: storedToken.id,
          });
          return {
            ok: false as const,
            error: new AuthError("TOKEN_EXPIRED", "Refresh token has expired."),
          };
        }

        const user = await repository.findUserById(storedToken.userId);

        if (!user) {
          return {
            ok: false as const,
            error: new AuthError(
              "TOKEN_INVALID",
              "Refresh token user is invalid.",
            ),
          };
        }

        assertActiveUser(user);
        await this.assertUserIdentityAvailable(user, true, repository);

        if (storedToken.tenantId !== user.tenantId) {
          await repository.revokeRefreshTokenFamily(storedToken.familyId);
          return {
            ok: false as const,
            error: new AuthError(
              "TOKEN_INVALID",
              "Refresh token tenant no longer matches the user account.",
            ),
          };
        }

        const terminal = storedToken.terminalId
          ? ((await repository.findPosTerminalById(storedToken.terminalId)) ??
            undefined)
          : undefined;
        const access = await repository.getUserAccess(
          user,
          terminal ? "pos" : "web",
        );

        if (
          storedToken.terminalId &&
          (!terminal ||
            terminal.tenantId !== storedToken.tenantId ||
            terminal.deviceId !== storedToken.deviceId)
        ) {
          await repository.revokeRefreshTokenFamily(storedToken.familyId);
          return {
            ok: false as const,
            error: new AuthError(
              "POS_TERMINAL_DISABLED",
              "The POS terminal session is no longer active.",
            ),
          };
        }

        if (terminal) {
          assertEnrolledTerminalCredential(terminal, input.terminalCredential);
        }

        const authContextBase = this.buildAuthContextBase(
          user,
          access,
          terminal,
        );
        const derivedRefreshToken = deriveRefreshTokenSuccessor(
          this.refreshTokenRotationSecret,
          storedToken.tokenHash,
          storedToken.familyId,
        );
        const issuedTokens = await this.tokenService.issueTokenPair(
          authContextBase,
          {
            refreshTokenTtlSeconds,
          },
        );

        let refreshTokenExpiresAt = issuedTokens.refreshTokenExpiresAt;

        if (isConcurrentRotationRetry) {
          const successor = await repository.findRefreshTokenByIdForUpdate(
            storedToken.replacedByTokenId!,
          );
          const successorMatches =
            successor &&
            successor.userId === storedToken.userId &&
            successor.tenantId === storedToken.tenantId &&
            successor.deviceId === storedToken.deviceId &&
            successor.terminalId === storedToken.terminalId &&
            successor.familyId === storedToken.familyId &&
            successor.tokenHash === hashOpaqueToken(derivedRefreshToken);

          if (!successorMatches || successor.revokedAt) {
            await repository.revokeRefreshTokenFamily(storedToken.familyId);
            return {
              ok: false as const,
              error: new AuthError(
                "TOKEN_REUSE_DETECTED",
                "Refresh token reuse detected.",
              ),
            };
          }

          if (successor.expiresAt.getTime() <= now) {
            await repository.revokeRefreshToken({
              tokenId: successor.id,
            });
            return {
              ok: false as const,
              error: new AuthError(
                "TOKEN_EXPIRED",
                "Refresh token has expired.",
              ),
            };
          }

          refreshTokenExpiresAt = successor.expiresAt;
        }

        const tokens = {
          ...issuedTokens,
          refreshToken: derivedRefreshToken,
          refreshTokenExpiresAt,
          refreshTokenFamilyId: storedToken.familyId,
        };
        const authContext = this.withAccessTokenExpiresAt(
          authContextBase,
          tokens.accessTokenExpiresAt,
        );

        if (!isConcurrentRotationRetry) {
          const newRefreshTokenId = await repository.createRefreshToken({
            userId: user.id,
            tenantId: user.tenantId,
            tokenHash: hashOpaqueToken(tokens.refreshToken),
            familyId: storedToken.familyId,
            expiresAt: tokens.refreshTokenExpiresAt,
            terminalId: terminal?.id,
            meta: terminal ? { ...input, deviceId: terminal.deviceId } : input,
          });

          if (!newRefreshTokenId) {
            throw new AuthError(
              "TOKEN_INVALID",
              "Failed to rotate refresh token.",
            );
          }

          await repository.revokeRefreshToken({
            tokenId: storedToken.id,
            replacedByTokenId: newRefreshTokenId,
          });
        }

        return {
          ok: true as const,
          result: {
            authContext,
            tokens,
            setCookieHeaders: createAuthCookieHeaders(tokens, {
              secure: this.cookieSecure,
            }),
          },
        };
      },
    );

    if (!outcome.ok) {
      throw outcome.error;
    }

    return outcome.result;
  }

  async logout(input: LogoutInput): Promise<string[]> {
    if (input.refreshToken) {
      const tokenHash = hashOpaqueToken(input.refreshToken);
      const tokenHint = await this.repository.findRefreshTokenByHash(tokenHash);

      if (tokenHint) {
        await this.repository.runInTransaction(async (repository) => {
          if (tokenHint.terminalId) {
            await repository.lockPosTerminalById(tokenHint.terminalId);
          }

          const storedToken =
            await repository.findRefreshTokenByHashForUpdate(tokenHash);
          if (!storedToken) return;

          await repository.revokeRefreshTokenFamily(storedToken.familyId);
          await repository.writeAuditLog({
            tenantId: storedToken.tenantId,
            actorUserId: storedToken.userId,
            eventType: "auth.logout",
            success: true,
            meta: input,
          });
        });
      }
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
      ? ((await this.repository.findPosTerminalById(claims.terminalId)) ??
        undefined)
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

    if (
      terminal &&
      terminal.credentialVersion !== claims.terminalCredentialVersion
    ) {
      throw new AuthError(
        "POS_TERMINAL_CREDENTIAL_INVALID",
        "The POS terminal credential changed. Sign in with a staff PIN again.",
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
      context.terminalCredentialVersion = terminal.credentialVersion;
    }

    return context;
  }

  private async assertUserIdentityAvailable(
    user: AuthenticatedUser,
    tokenSession: boolean,
    repository: AuthRepository = this.repository,
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
      (!user.tenantId || !(await repository.isTenantActive(user.tenantId)))
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
