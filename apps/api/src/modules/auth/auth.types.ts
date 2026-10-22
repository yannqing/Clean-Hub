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
  deviceId: string;
  terminalCredential?: string;
};

export type PosBootstrapStatus =
  | "unconfigured"
  | "admin_setup_required"
  | "enrolled"
  | "disabled"
  | "credential_lost"
  | "ready_for_pin";

export type PosBootstrapTerminal = {
  id: string;
  label: string | null;
  status: "active" | "inactive";
  branchId: string;
};

export type PosBootstrapTenant = {
  id: string;
  name: string;
  code: string;
};

export type PosBootstrapBranch = {
  id: string;
  name: string;
};

export type PosBootstrapState = {
  status: PosBootstrapStatus;
  deviceId: string;
  requiresAdminLogin: boolean;
  canEnroll: boolean;
  terminal: PosBootstrapTerminal | null;
  tenant: PosBootstrapTenant | null;
  branch: PosBootstrapBranch | null;
};

export type PosBootstrapInput = {
  deviceId: string;
  accessToken?: string;
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
  /** Tenant-wide interface language. Every tenant page follows this value. */
  language?: "en" | "fr" | "zh-CN";
  /** Tenant-wide business timezone. Every branch inherits this value. */
  timezone?: string;
  terminalId?: string;
  terminalBranchId?: string;
  terminalDeviceId?: string;
  terminalCredentialVersion?: number;
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
  language?: "en" | "fr" | "zh-CN";
  timezone?: string;
};
