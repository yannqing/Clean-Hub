import type { AuthRequestMeta, AuthTokenPair } from "../../auth/auth.types.js";

export type MobileSubjectType = "customer" | "staff";
export type MobileRole = "customer" | "driver" | "owner";

export type MobileAuthRequestMeta = AuthRequestMeta;

export type MobileAuthContext = {
  subjectType: MobileSubjectType;
  subjectId: string;
  displayName: string;
  tenantId: string;
  currency: string;
  branchIds: string[];
  role: MobileRole;
  roles: MobileRole[];
  permissions: string[];
  accessTokenExpiresAt: string;
};

export type MobileTokenResponse = {
  authContext: MobileAuthContext;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  tokenType: "Bearer";
};

export type MobileAuthResult = {
  authContext: MobileAuthContext;
  tokens: AuthTokenPair;
};

export type MobileRequestOtpInput = MobileAuthRequestMeta & {
  tenantCode: string;
  phone: string;
};

export type MobileVerifyOtpInput = MobileAuthRequestMeta & {
  tenantCode: string;
  phone: string;
  code: string;
};

export type MobileCustomerPasswordLoginInput = MobileAuthRequestMeta & {
  tenantCode: string;
  identifier: string;
  password: string;
};

export type MobileStaffLoginInput = MobileAuthRequestMeta & {
  tenantCode: string;
  identifier: string;
  password: string;
  role: "driver" | "owner";
};

export type MobileRefreshInput = MobileAuthRequestMeta & {
  refreshToken: string;
};

export type MobileLogoutInput = MobileAuthRequestMeta & {
  refreshToken: string;
};

export type MobileCustomerAccount = {
  id: string;
  tenantId: string;
  accountName: string;
  phone: string | null;
  email: string | null;
  status: "active" | "disabled";
};

export type MobileCustomerCredential = {
  id: string;
  tenantId: string;
  customerAccountId: string;
  passwordHash: string;
  failedAttempts: number;
  lockedUntil: Date | null;
};

export type MobileCustomerOtp = {
  id: string;
  tenantId: string;
  customerAccountId: string;
  phone: string;
  code: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
};

export type MobileStaffUser = {
  id: string;
  tenantId: string | null;
  userType: "saas" | "tenant";
  email: string | null;
  passwordHash: string;
  status: "invited" | "active" | "disabled" | "suspended";
};

export type MobileStoredRefreshToken = {
  id: string;
  subjectId: string;
  tenantId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type MobileTestOtpResult = {
  code?: string;
  expiresAt: string;
};
