import { createHash, randomBytes } from "node:crypto";

import { createId } from "@cleanhub/id";
import { jwtVerify, SignJWT } from "jose";

import { AuthError } from "./auth.errors.js";
import type { AuthTokenPair } from "./auth.types.js";

export type AccessTokenClaims = {
  sub: string;
  subjectType: string;
  tenantId: string | null;
  role: string;
  roles: string[];
  permissions: string[];
  branchIds: string[];
  terminalId?: string;
  terminalBranchId?: string;
  terminalDeviceId?: string;
  terminalCredentialVersion?: number;
  expiresAt: Date;
};

export type TokenIssueContext = {
  userId: string;
  subjectType?: string;
  tenantId: string | null;
  role: string;
  roles: string[];
  permissions: string[];
  branchIds: string[];
  terminalId?: string;
  terminalBranchId?: string;
  terminalDeviceId?: string;
  terminalCredentialVersion?: number;
};

export type TokenServiceOptions = {
  secret: string;
  issuer?: string;
  audience?: string;
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
};

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

function getSecretKey(secret: string): Uint8Array {
  if (secret.length < 32) {
    throw new AuthError(
      "AUTH_CONFIG_INVALID",
      "AUTH_TOKEN_SECRET must be at least 32 characters.",
    );
  }

  return new TextEncoder().encode(secret);
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function generateOpaqueToken(): string {
  return randomBytes(48).toString("base64url");
}

export class TokenService {
  private readonly secretKey: Uint8Array;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;

  constructor({
    secret,
    issuer = "cleanhub-api",
    audience = "cleanhub-admin",
    accessTokenTtlSeconds = DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds = DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
  }: TokenServiceOptions) {
    this.secretKey = getSecretKey(secret);
    this.issuer = issuer;
    this.audience = audience;
    this.accessTokenTtlSeconds = accessTokenTtlSeconds;
    this.refreshTokenTtlSeconds = refreshTokenTtlSeconds;
  }

  async issueTokenPair(
    context: TokenIssueContext,
    options?: { refreshTokenTtlSeconds?: number },
  ): Promise<AuthTokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const refreshTokenTtlSeconds =
      options?.refreshTokenTtlSeconds ?? this.refreshTokenTtlSeconds;
    const accessTokenExpiresAt = new Date(
      (now + this.accessTokenTtlSeconds) * 1000,
    );
    const refreshTokenExpiresAt = new Date(
      (now + refreshTokenTtlSeconds) * 1000,
    );

    const accessToken = await new SignJWT({
      subjectType: context.subjectType ?? "user",
      tenantId: context.tenantId,
      role: context.role,
      roles: context.roles,
      permissions: context.permissions,
      branchIds: context.branchIds,
      terminalId: context.terminalId,
      terminalBranchId: context.terminalBranchId,
      terminalDeviceId: context.terminalDeviceId,
      terminalCredentialVersion: context.terminalCredentialVersion,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(context.userId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setJti(createId())
      .setIssuedAt(now)
      .setExpirationTime(now + this.accessTokenTtlSeconds)
      .sign(this.secretKey);

    return {
      accessToken,
      refreshToken: generateOpaqueToken(),
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      refreshTokenFamilyId: createId(),
    };
  }

  async verifyAccessToken(accessToken: string): Promise<AccessTokenClaims> {
    try {
      const result = await jwtVerify(accessToken, this.secretKey, {
        issuer: this.issuer,
        audience: this.audience,
      });

      return {
        sub: result.payload.sub ?? "",
        subjectType:
          typeof result.payload.subjectType === "string"
            ? result.payload.subjectType
            : "user",
        tenantId:
          typeof result.payload.tenantId === "string"
            ? result.payload.tenantId
            : null,
        role: String(result.payload.role),
        roles: Array.isArray(result.payload.roles)
          ? result.payload.roles.map(String)
          : [],
        permissions: Array.isArray(result.payload.permissions)
          ? result.payload.permissions.map(String)
          : [],
        branchIds: Array.isArray(result.payload.branchIds)
          ? result.payload.branchIds.map(String)
          : [],
        terminalId:
          typeof result.payload.terminalId === "string"
            ? result.payload.terminalId
            : undefined,
        terminalBranchId:
          typeof result.payload.terminalBranchId === "string"
            ? result.payload.terminalBranchId
            : undefined,
        terminalDeviceId:
          typeof result.payload.terminalDeviceId === "string"
            ? result.payload.terminalDeviceId
            : undefined,
        terminalCredentialVersion:
          typeof result.payload.terminalCredentialVersion === "number"
            ? result.payload.terminalCredentialVersion
            : undefined,
        expiresAt: new Date(Number(result.payload.exp ?? 0) * 1000),
      };
    } catch {
      throw new AuthError("TOKEN_INVALID", "Access token is invalid.");
    }
  }
}
