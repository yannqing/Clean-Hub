export type MobileSubjectType = "customer" | "staff";
export type MobileRole = "customer" | "driver" | "owner";

export type MobileAuthContext = {
  subjectType: MobileSubjectType;
  subjectId: string;
  displayName: string;
  tenantId: string;
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

export type MobileRequestOtpRequest = {
  tenantCode: string;
  phone: string;
  deviceId?: string;
};

export type MobileVerifyOtpRequest = MobileRequestOtpRequest & {
  code: string;
};

export type MobilePasswordLoginRequest = {
  tenantCode: string;
  identifier: string;
  password: string;
  deviceId?: string;
};

export type MobileRefreshRequest = {
  refreshToken: string;
  deviceId?: string;
};

export type MobileLogoutRequest = MobileRefreshRequest;

export type MobileTestOtpResponse = {
  code: string;
  expiresAt: string;
};
