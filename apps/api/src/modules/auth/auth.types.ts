import type { Database } from "@cleanhub/db";

export type AdminRole =
  | "super_admin"
  | "support"
  | "owner"
  | "manager"
  | "cashier"
  | "driver";

export type AuthRequestMeta = {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
};

export type LoginInput = AuthRequestMeta & {
  identifier: string;
  password: string;
};

export type PosPinLoginInput = AuthRequestMeta & {
  pin: string;
  tenantCode: string;
  deviceId: string;
  terminalCredential?: string;
};

export type RefreshInput = AuthRequestMeta & {
  refreshToken: string;
  terminalCredential?: string;
};

export type LogoutInput = AuthRequestMeta & {
  refreshToken?: string;
  accessToken?: string;
};

export type AuthContext = {
  userId: string;
  displayName: string;
  tenantId: string | null;
  branchIds: string[];
  role: AdminRole;
  roles: string[];
  permissions: string[];
  terminalId?: string;
  terminalBranchId?: string;
  terminalDeviceId?: string;
  accessTokenExpiresAt: string;
};

export type AuthTokenPair = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  refreshTokenFamilyId: string;
};

export type AuthResult = {
  authContext: AuthContext;
  tokens: AuthTokenPair;
  setCookieHeaders: string[];
};

export type RefreshResult = AuthResult;

export type AuthServiceOptions = {
  db: Database;
  accessTokenSecret: string;
  cookieSecure?: boolean;
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
};

export type AuthenticatedUser = {
  id: string;
  tenantId: string | null;
  userType: "saas" | "tenant";
  email: string | null;
  passwordHash: string;
  pinHash: string;
  status: "invited" | "active" | "disabled" | "suspended";
};

export type UserAccess = {
  roles: string[];
  permissions: string[];
  branchIds: string[];
  displayName: string;
};
