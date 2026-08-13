import { randomInt } from "node:crypto";

import { getDb, type Database } from "@cleanhub/db";

import { AuthError, invalidCredentials } from "../../auth/auth.errors.js";
import {
  type EffectiveSecurityPolicy,
  getRefreshTokenTtlSeconds,
  resolveEffectiveSecurityPolicy,
} from "../../saas/security/security-policy.js";
import { verifyPassword } from "../../auth/password.service.js";
import { hashOpaqueToken, TokenService } from "../../auth/token.service.js";
import type { AccessTokenClaims } from "../../auth/token.service.js";
import {
  buildLoginLockKey,
  clearLoginLockout,
  recordLoginFailure,
  assertLoginNotLocked,
} from "../../auth/login-lockout.helper.js";
import { MobileAuthRepository } from "./auth.repository.js";
import type {
  MobileAuthContext,
  MobileAuthResult,
  MobileCustomerAccount,
  MobileCustomerPasswordLoginInput,
  MobileLogoutInput,
  MobileRefreshInput,
  MobileRequestOtpInput,
  MobileRole,
  MobileStaffLoginInput,
  MobileStaffUser,
  MobileStoredRefreshToken,
  MobileTestOtpResult,
  MobileVerifyOtpInput,
} from "./auth.types.js";

export type MobileAuthServiceOptions = {
  db: Database;
  repository?: MobileAuthRepositoryLike;
  securityPolicy?: EffectiveSecurityPolicy;
  accessTokenSecret: string;
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
  testOtpEnabled?: boolean;
};

export type CreateMobileAuthServiceFromEnvOptions = {
  db?: Database;
  env?: NodeJS.ProcessEnv;
};

const CUSTOMER_REFRESH_PREFIX = "cust_";
const STAFF_REFRESH_PREFIX = "staff_";
const OTP_TTL_MINUTES = 10;
const OTP_CODE_MAX = 1_000_000;

export type MobileAuthRepositoryLike = Pick<
  MobileAuthRepository,
  | "findActiveTenantByCode"
  | "findTenantById"
  | "findCustomerByPhone"
  | "findCustomerByIdentifier"
  | "findCustomerById"
  | "findCustomerCredential"
  | "createCustomerOtp"
  | "findLatestCustomerOtp"
  | "incrementCustomerOtpAttempts"
  | "consumeCustomerOtp"
  | "recordCustomerPasswordFailure"
  | "clearCustomerPasswordFailures"
  | "createCustomerRefreshToken"
  | "findCustomerRefreshTokenByHash"
  | "revokeCustomerRefreshToken"
  | "revokeCustomerRefreshTokenFamily"
  | "revokeCustomerRefreshTokenByHash"
  | "findStaffLoginUser"
  | "findStaffUserById"
  | "getStaffAccess"
  | "updateStaffLastLoginAt"
  | "createStaffRefreshToken"
  | "findStaffRefreshTokenByHash"
  | "revokeStaffRefreshToken"
  | "revokeStaffRefreshTokenFamily"
  | "revokeStaffRefreshTokenByHash"
>;

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function normalizeTenantCode(tenantCode: string): string {
  return tenantCode.trim();
}

function normalizePhone(phone: string): string {
  return phone.trim();
}

function generateOtpCode(): string {
  return randomInt(0, OTP_CODE_MAX).toString().padStart(6, "0");
}

function assertActiveCustomer(customer: MobileCustomerAccount): void {
  if (customer.status !== "active") {
    throw invalidCredentials();
  }
}

function assertActiveStaff(user: MobileStaffUser): void {
  if (user.status === "disabled") {
    throw new AuthError("USER_DISABLED", "User is disabled.");
  }

  if (user.status === "suspended") {
    throw new AuthError("USER_SUSPENDED", "User is suspended.");
  }

  if (
    user.status !== "active" ||
    user.userType !== "tenant" ||
    !user.tenantId
  ) {
    throw invalidCredentials();
  }
}

function wrapCustomerRefreshToken(rawToken: string): string {
  return `${CUSTOMER_REFRESH_PREFIX}${rawToken}`;
}

function wrapStaffRefreshToken(rawToken: string): string {
  return `${STAFF_REFRESH_PREFIX}${rawToken}`;
}

function unwrapRefreshToken(refreshToken: string): {
  kind: "customer" | "staff";
  rawToken: string;
} {
  if (refreshToken.startsWith(CUSTOMER_REFRESH_PREFIX)) {
    return {
      kind: "customer",
      rawToken: refreshToken.slice(CUSTOMER_REFRESH_PREFIX.length),
    };
  }

  if (refreshToken.startsWith(STAFF_REFRESH_PREFIX)) {
    return {
      kind: "staff",
      rawToken: refreshToken.slice(STAFF_REFRESH_PREFIX.length),
    };
  }

  throw new AuthError("TOKEN_INVALID", "Refresh token is invalid.");
}

function readOptionalPositiveInteger(
  value: string | undefined,
): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readBooleanFlag(value: string | undefined): boolean {
  return value === "true";
}

export function createMobileAuthServiceFromEnv({
  db = getDb(),
  env = process.env,
}: CreateMobileAuthServiceFromEnvOptions = {}): MobileAuthService {
  const accessTokenSecret = env.AUTH_TOKEN_SECRET;

  if (!accessTokenSecret) {
    throw new AuthError(
      "AUTH_CONFIG_INVALID",
      "AUTH_TOKEN_SECRET is required to initialize MobileAuthService.",
    );
  }

  return new MobileAuthService({
    db,
    accessTokenSecret,
    accessTokenTtlSeconds: readOptionalPositiveInteger(
      env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    ),
    refreshTokenTtlSeconds: readOptionalPositiveInteger(
      env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
    ),
    testOtpEnabled: readBooleanFlag(env.MOBILE_AUTH_TEST_OTP_ENABLED),
  });
}

export class MobileAuthService {
  private readonly db: Database;
  private readonly repository: MobileAuthRepositoryLike;
  private readonly tokenService: TokenService;
  private readonly envRefreshTokenTtlSeconds: number;
  private readonly securityPolicy?: EffectiveSecurityPolicy;
  private readonly testOtpEnabled: boolean;

  constructor({
    db,
    repository,
    securityPolicy,
    accessTokenSecret,
    accessTokenTtlSeconds,
    refreshTokenTtlSeconds,
    testOtpEnabled = false,
  }: MobileAuthServiceOptions) {
    this.db = db;
    this.repository = repository ?? new MobileAuthRepository(db);
    this.securityPolicy = securityPolicy;
    this.testOtpEnabled = testOtpEnabled;
    this.envRefreshTokenTtlSeconds =
      refreshTokenTtlSeconds ?? 30 * 24 * 60 * 60;
    this.tokenService = new TokenService({
      secret: accessTokenSecret,
      audience: "cleanhub-mobile",
      accessTokenTtlSeconds,
      refreshTokenTtlSeconds: this.envRefreshTokenTtlSeconds,
    });
  }

  isTestOtpEnabled(): boolean {
    return this.testOtpEnabled;
  }

  async requestCustomerOtp(
    input: MobileRequestOtpInput,
  ): Promise<MobileTestOtpResult> {
    const tenant = await this.resolveTenant(input.tenantCode);
    const phone = normalizePhone(input.phone);
    const customer = await this.repository.findCustomerByPhone({
      tenantId: tenant.id,
      phone,
    });

    if (!customer) {
      throw invalidCredentials();
    }

    assertActiveCustomer(customer);

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.repository.createCustomerOtp({
      tenantId: tenant.id,
      customerAccountId: customer.id,
      phone,
      code,
      expiresAt,
    });

    return {
      code: this.testOtpEnabled ? code : undefined,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getCustomerTestOtp(
    input: MobileRequestOtpInput,
  ): Promise<MobileTestOtpResult> {
    if (!this.testOtpEnabled) {
      throw new AuthError("FEATURE_DISABLED", "Test OTP is disabled.");
    }

    const tenant = await this.resolveTenant(input.tenantCode);
    const phone = normalizePhone(input.phone);
    const customer = await this.repository.findCustomerByPhone({
      tenantId: tenant.id,
      phone,
    });

    if (!customer) {
      throw invalidCredentials();
    }

    assertActiveCustomer(customer);

    const otp = await this.repository.findLatestCustomerOtp({
      tenantId: tenant.id,
      customerAccountId: customer.id,
      phone,
    });

    if (!otp || otp.consumedAt || otp.expiresAt.getTime() <= Date.now()) {
      throw new AuthError("TOKEN_INVALID", "No active OTP is available.");
    }

    return {
      code: otp.code,
      expiresAt: otp.expiresAt.toISOString(),
    };
  }

  async verifyCustomerOtp(
    input: MobileVerifyOtpInput,
  ): Promise<MobileAuthResult> {
    const tenant = await this.resolveTenant(input.tenantCode);
    const phone = normalizePhone(input.phone);
    const customer = await this.repository.findCustomerByPhone({
      tenantId: tenant.id,
      phone,
    });

    if (!customer) {
      throw invalidCredentials();
    }

    assertActiveCustomer(customer);

    const otp = await this.repository.findLatestCustomerOtp({
      tenantId: tenant.id,
      customerAccountId: customer.id,
      phone,
    });

    if (!otp || otp.consumedAt || otp.expiresAt.getTime() <= Date.now()) {
      throw invalidCredentials();
    }

    if (otp.attempts >= otp.maxAttempts) {
      throw new AuthError(
        "ACCOUNT_LOCKED",
        "Too many failed OTP attempts. Request a new code.",
      );
    }

    if (otp.code !== input.code.trim()) {
      await this.repository.incrementCustomerOtpAttempts({
        tenantId: tenant.id,
        otpId: otp.id,
      });
      throw invalidCredentials();
    }

    await this.repository.consumeCustomerOtp({
      tenantId: tenant.id,
      otpId: otp.id,
    });

    return this.issueCustomerTokens(customer, input);
  }

  async loginCustomerWithPassword(
    input: MobileCustomerPasswordLoginInput,
  ): Promise<MobileAuthResult> {
    const tenant = await this.resolveTenant(input.tenantCode);
    const identifier = normalizeIdentifier(input.identifier);
    const customer = await this.repository.findCustomerByIdentifier({
      tenantId: tenant.id,
      identifier,
    });

    if (!customer) {
      throw invalidCredentials();
    }

    assertActiveCustomer(customer);

    const credential = await this.repository.findCustomerCredential({
      tenantId: tenant.id,
      customerAccountId: customer.id,
    });

    if (!credential) {
      throw invalidCredentials();
    }

    const now = Date.now();

    if (credential.lockedUntil && credential.lockedUntil.getTime() > now) {
      throw new AuthError(
        "ACCOUNT_LOCKED",
        "Too many failed login attempts. Try again later.",
      );
    }

    const passwordValid = await verifyPassword(
      input.password,
      credential.passwordHash,
    );

    if (!passwordValid) {
      const policy = await this.resolveSecurityPolicy();
      const failedAttempts =
        credential.lockedUntil && credential.lockedUntil.getTime() <= now
          ? 1
          : credential.failedAttempts + 1;

      if (failedAttempts >= policy.loginMaxAttempts) {
        await this.repository.recordCustomerPasswordFailure({
          tenantId: tenant.id,
          credentialId: credential.id,
          failedAttempts: 0,
          lockedUntil: new Date(now + policy.lockoutMinutes * 60 * 1000),
        });
        throw new AuthError(
          "ACCOUNT_LOCKED",
          "Too many failed login attempts. Try again later.",
        );
      }

      await this.repository.recordCustomerPasswordFailure({
        tenantId: tenant.id,
        credentialId: credential.id,
        failedAttempts,
        lockedUntil: null,
      });
      throw invalidCredentials();
    }

    await this.repository.clearCustomerPasswordFailures({
      tenantId: tenant.id,
      credentialId: credential.id,
    });

    return this.issueCustomerTokens(customer, input);
  }

  async loginStaff(input: MobileStaffLoginInput): Promise<MobileAuthResult> {
    const tenant = await this.resolveTenant(input.tenantCode);
    const identifier = normalizeIdentifier(input.identifier);
    const lockKey = buildLoginLockKey(
      `mobile:${input.role}:${identifier}`,
      normalizeTenantCode(input.tenantCode),
    );
    const policy = await this.resolveSecurityPolicy();

    await assertLoginNotLocked(this.db, lockKey);

    const user = await this.repository.findStaffLoginUser({
      identifier,
      tenantId: tenant.id,
    });

    if (!user) {
      await recordLoginFailure(this.db, lockKey, policy);
      throw invalidCredentials();
    }

    assertActiveStaff(user);

    const access = await this.repository.getStaffAccess({
      tenantId: tenant.id,
      userId: user.id,
    });
    if (!access.roles.includes(input.role)) {
      await recordLoginFailure(this.db, lockKey, policy);
      throw invalidCredentials();
    }

    const passwordValid = await verifyPassword(
      input.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      await recordLoginFailure(this.db, lockKey, policy);
      throw invalidCredentials();
    }

    await clearLoginLockout(this.db, lockKey);
    await this.repository.updateStaffLastLoginAt({
      tenantId: tenant.id,
      userId: user.id,
    });

    return this.issueStaffTokens(user, access, input.role, input);
  }

  async refresh(input: MobileRefreshInput): Promise<MobileAuthResult> {
    const parsed = unwrapRefreshToken(input.refreshToken);

    if (parsed.kind === "customer") {
      return this.refreshCustomer(parsed.rawToken, input);
    }

    return this.refreshStaff(parsed.rawToken, input);
  }

  async logout(input: MobileLogoutInput): Promise<void> {
    const parsed = unwrapRefreshToken(input.refreshToken);
    const tokenHash = hashOpaqueToken(parsed.rawToken);

    if (parsed.kind === "customer") {
      const storedToken =
        await this.repository.findCustomerRefreshTokenByHash(tokenHash);
      if (storedToken) {
        await this.repository.revokeCustomerRefreshTokenByHash({
          tenantId: storedToken.tenantId,
          tokenHash,
        });
      }
      return;
    }

    const storedToken =
      await this.repository.findStaffRefreshTokenByHash(tokenHash);
    if (storedToken) {
      await this.repository.revokeStaffRefreshTokenByHash({
        tenantId: storedToken.tenantId,
        tokenHash,
      });
    }
  }

  async getMobileAuthContext(accessToken: string): Promise<MobileAuthContext> {
    const claims = await this.tokenService.verifyAccessToken(accessToken);

    if (!claims.sub) {
      throw new AuthError("TOKEN_INVALID", "Access token subject is missing.");
    }

    if (claims.subjectType === "customer") {
      return this.getCustomerContextFromClaims(claims);
    }

    if (claims.subjectType === "staff") {
      return this.getStaffContextFromClaims(claims);
    }

    throw new AuthError("TOKEN_INVALID", "Access token subject is invalid.");
  }

  private async refreshCustomer(
    rawToken: string,
    input: MobileRefreshInput,
  ): Promise<MobileAuthResult> {
    const storedToken = await this.findValidCustomerRefreshToken(rawToken);
    const resolvedCustomer =
      await this.findCustomerAccountByRefreshToken(storedToken);

    if (!resolvedCustomer) {
      throw new AuthError(
        "TOKEN_INVALID",
        "Refresh token customer is invalid.",
      );
    }

    assertActiveCustomer(resolvedCustomer);

    const issued = await this.issueCustomerTokens(resolvedCustomer, input, {
      familyId: storedToken.familyId,
    });

    await this.repository.revokeCustomerRefreshToken({
      tenantId: storedToken.tenantId,
      tokenId: storedToken.id,
      replacedByTokenId: issued.refreshTokenId,
    });

    return issued;
  }

  private async refreshStaff(
    rawToken: string,
    input: MobileRefreshInput,
  ): Promise<MobileAuthResult> {
    const storedToken = await this.findValidStaffRefreshToken(rawToken);
    const user = await this.repository.findStaffUserById({
      tenantId: storedToken.tenantId,
      userId: storedToken.subjectId,
    });

    if (!user) {
      throw new AuthError("TOKEN_INVALID", "Refresh token user is invalid.");
    }

    assertActiveStaff(user);

    const access = await this.repository.getStaffAccess({
      tenantId: storedToken.tenantId,
      userId: user.id,
    });
    const role = this.resolveMobileStaffRole(access.roles);

    if (!role) {
      throw new AuthError("FORBIDDEN", "Mobile staff role is required.");
    }

    const issued = await this.issueStaffTokens(user, access, role, input, {
      familyId: storedToken.familyId,
    });

    await this.repository.revokeStaffRefreshToken({
      tenantId: storedToken.tenantId,
      tokenId: storedToken.id,
      replacedByTokenId: issued.refreshTokenId,
    });

    return issued;
  }

  private async findValidCustomerRefreshToken(
    rawToken: string,
  ): Promise<MobileStoredRefreshToken> {
    const storedToken = await this.repository.findCustomerRefreshTokenByHash(
      hashOpaqueToken(rawToken),
    );

    if (!storedToken) {
      throw new AuthError("TOKEN_INVALID", "Refresh token is invalid.");
    }

    if (storedToken.revokedAt) {
      await this.repository.revokeCustomerRefreshTokenFamily({
        tenantId: storedToken.tenantId,
        familyId: storedToken.familyId,
      });
      throw new AuthError(
        "TOKEN_REUSE_DETECTED",
        "Refresh token reuse detected.",
      );
    }

    if (storedToken.expiresAt.getTime() <= Date.now()) {
      await this.repository.revokeCustomerRefreshToken({
        tenantId: storedToken.tenantId,
        tokenId: storedToken.id,
      });
      throw new AuthError("TOKEN_EXPIRED", "Refresh token has expired.");
    }

    return storedToken;
  }

  private async findValidStaffRefreshToken(
    rawToken: string,
  ): Promise<MobileStoredRefreshToken> {
    const storedToken = await this.repository.findStaffRefreshTokenByHash(
      hashOpaqueToken(rawToken),
    );

    if (!storedToken) {
      throw new AuthError("TOKEN_INVALID", "Refresh token is invalid.");
    }

    if (storedToken.revokedAt) {
      await this.repository.revokeStaffRefreshTokenFamily({
        tenantId: storedToken.tenantId,
        familyId: storedToken.familyId,
      });
      throw new AuthError(
        "TOKEN_REUSE_DETECTED",
        "Refresh token reuse detected.",
      );
    }

    if (storedToken.expiresAt.getTime() <= Date.now()) {
      await this.repository.revokeStaffRefreshToken({
        tenantId: storedToken.tenantId,
        tokenId: storedToken.id,
      });
      throw new AuthError("TOKEN_EXPIRED", "Refresh token has expired.");
    }

    return storedToken;
  }

  private async issueCustomerTokens(
    customer: MobileCustomerAccount,
    meta:
      | MobileRequestOtpInput
      | MobileVerifyOtpInput
      | MobileCustomerPasswordLoginInput
      | MobileRefreshInput,
    options?: { familyId?: string },
  ): Promise<MobileAuthResult & { refreshTokenId: string }> {
    const tenant = await this.resolveTenantById(customer.tenantId);
    const contextBase = {
      subjectType: "customer" as const,
      subjectId: customer.id,
      displayName: customer.accountName,
      tenantId: tenant.id,
      currency: tenant.defaultCurrency,
      timezone: tenant.timezone ?? "UTC",
      branchIds: [],
      role: "customer" as const,
      roles: ["customer" as const],
      permissions: [],
    };
    const refreshTokenTtlSeconds = await this.getRefreshTokenTtlSeconds();
    const issuedTokens = await this.tokenService.issueTokenPair(
      {
        userId: customer.id,
        subjectType: "customer",
        tenantId: tenant.id,
        role: "customer",
        roles: ["customer"],
        permissions: [],
        branchIds: [],
      },
      { refreshTokenTtlSeconds },
    );
    const tokens = {
      ...issuedTokens,
      refreshToken: wrapCustomerRefreshToken(issuedTokens.refreshToken),
      refreshTokenFamilyId:
        options?.familyId ?? issuedTokens.refreshTokenFamilyId,
    };
    const rawRefreshToken = tokens.refreshToken.slice(
      CUSTOMER_REFRESH_PREFIX.length,
    );
    const refreshTokenId = await this.repository.createCustomerRefreshToken({
      customerAccountId: customer.id,
      tenantId: tenant.id,
      tokenHash: hashOpaqueToken(rawRefreshToken),
      familyId: tokens.refreshTokenFamilyId,
      expiresAt: tokens.refreshTokenExpiresAt,
      meta,
    });

    if (!refreshTokenId) {
      throw new AuthError("TOKEN_INVALID", "Failed to create refresh token.");
    }

    return {
      authContext: {
        ...contextBase,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
      },
      tokens,
      refreshTokenId,
    };
  }

  private async issueStaffTokens(
    user: MobileStaffUser,
    access: {
      displayName: string;
      roles: string[];
      permissions: string[];
      branchIds: string[];
    },
    role: "driver" | "owner",
    meta: MobileStaffLoginInput | MobileRefreshInput,
    options?: { familyId?: string },
  ): Promise<MobileAuthResult & { refreshTokenId: string }> {
    if (!user.tenantId) {
      throw invalidCredentials();
    }

    const tenant = await this.resolveTenantById(user.tenantId);
    const refreshTokenTtlSeconds = await this.getRefreshTokenTtlSeconds();
    const issuedTokens = await this.tokenService.issueTokenPair(
      {
        userId: user.id,
        subjectType: "staff",
        tenantId: tenant.id,
        role,
        roles: access.roles,
        permissions: access.permissions,
        branchIds: access.branchIds,
      },
      { refreshTokenTtlSeconds },
    );
    const tokens = {
      ...issuedTokens,
      refreshToken: wrapStaffRefreshToken(issuedTokens.refreshToken),
      refreshTokenFamilyId:
        options?.familyId ?? issuedTokens.refreshTokenFamilyId,
    };
    const rawRefreshToken = tokens.refreshToken.slice(
      STAFF_REFRESH_PREFIX.length,
    );
    const refreshTokenId = await this.repository.createStaffRefreshToken({
      userId: user.id,
      tenantId: tenant.id,
      tokenHash: hashOpaqueToken(rawRefreshToken),
      familyId: tokens.refreshTokenFamilyId,
      expiresAt: tokens.refreshTokenExpiresAt,
      meta,
    });

    if (!refreshTokenId) {
      throw new AuthError("TOKEN_INVALID", "Failed to create refresh token.");
    }

    return {
      authContext: {
        subjectType: "staff",
        subjectId: user.id,
        displayName: access.displayName,
        tenantId: tenant.id,
        currency: tenant.defaultCurrency,
        timezone: tenant.timezone ?? "UTC",
        branchIds: access.branchIds,
        role,
        roles: access.roles.filter(
          (candidate): candidate is MobileRole =>
            candidate === "driver" || candidate === "owner",
        ),
        permissions: access.permissions,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
      },
      tokens,
      refreshTokenId,
    };
  }

  private async resolveTenant(
    tenantCode: string,
  ): Promise<{ id: string; defaultCurrency: string; timezone?: string }> {
    const tenant = await this.repository.findActiveTenantByCode(
      normalizeTenantCode(tenantCode),
    );

    if (!tenant) {
      throw invalidCredentials();
    }

    return tenant;
  }

  private async resolveTenantById(
    tenantId: string,
  ): Promise<{ id: string; defaultCurrency: string; timezone?: string }> {
    const tenant = await this.repository.findTenantById(tenantId);

    if (!tenant) {
      throw invalidCredentials();
    }

    return tenant;
  }

  private async getRefreshTokenTtlSeconds(): Promise<number> {
    const policy = await this.resolveSecurityPolicy();

    return getRefreshTokenTtlSeconds(policy);
  }

  private async resolveSecurityPolicy(): Promise<EffectiveSecurityPolicy> {
    return this.securityPolicy ?? resolveEffectiveSecurityPolicy(this.db);
  }

  private async getCustomerContextFromClaims(
    claims: AccessTokenClaims,
  ): Promise<MobileAuthContext> {
    if (!claims.tenantId || claims.role !== "customer") {
      throw new AuthError("TOKEN_INVALID", "Access token is invalid.");
    }

    const resolvedCustomer = await this.findCustomerById(
      claims.tenantId,
      claims.sub,
    );

    if (!resolvedCustomer) {
      throw new AuthError("TOKEN_INVALID", "Access token customer is invalid.");
    }

    assertActiveCustomer(resolvedCustomer);
    const tenant = await this.resolveTenantById(resolvedCustomer.tenantId);

    return {
      subjectType: "customer",
      subjectId: resolvedCustomer.id,
      displayName: resolvedCustomer.accountName,
      tenantId: tenant.id,
      currency: tenant.defaultCurrency,
      timezone: tenant.timezone ?? "UTC",
      branchIds: [],
      role: "customer",
      roles: ["customer"],
      permissions: [],
      accessTokenExpiresAt: claims.expiresAt.toISOString(),
    };
  }

  private async getStaffContextFromClaims(
    claims: AccessTokenClaims,
  ): Promise<MobileAuthContext> {
    if (!claims.tenantId) {
      throw new AuthError("TOKEN_INVALID", "Access token is invalid.");
    }

    const user = await this.repository.findStaffUserById({
      tenantId: claims.tenantId,
      userId: claims.sub,
    });

    if (!user) {
      throw new AuthError("TOKEN_INVALID", "Access token user is invalid.");
    }

    assertActiveStaff(user);
    const tenant = await this.resolveTenantById(claims.tenantId);

    const access = await this.repository.getStaffAccess({
      tenantId: claims.tenantId,
      userId: user.id,
    });
    const role =
      claims.role === "driver" || claims.role === "owner"
        ? claims.role
        : this.resolveMobileStaffRole(access.roles);

    if (!role || !access.roles.includes(role)) {
      throw new AuthError("FORBIDDEN", "Mobile staff role is required.");
    }

    return {
      subjectType: "staff",
      subjectId: user.id,
      displayName: access.displayName,
      tenantId: tenant.id,
      currency: tenant.defaultCurrency,
      timezone: tenant.timezone ?? "UTC",
      branchIds: access.branchIds,
      role,
      roles: access.roles.filter(
        (candidate): candidate is MobileRole =>
          candidate === "driver" || candidate === "owner",
      ),
      permissions: access.permissions,
      accessTokenExpiresAt: claims.expiresAt.toISOString(),
    };
  }

  private resolveMobileStaffRole(roles: string[]): "driver" | "owner" | null {
    if (roles.includes("driver")) {
      return "driver";
    }

    if (roles.includes("owner")) {
      return "owner";
    }

    return null;
  }

  private async findCustomerById(
    tenantId: string,
    customerAccountId: string,
  ): Promise<MobileCustomerAccount | null> {
    return this.repository.findCustomerById({
      tenantId,
      customerAccountId,
    });
  }

  private async findCustomerAccountByRefreshToken(
    storedToken: MobileStoredRefreshToken,
  ): Promise<MobileCustomerAccount | null> {
    return this.findCustomerById(storedToken.tenantId, storedToken.subjectId);
  }
}
