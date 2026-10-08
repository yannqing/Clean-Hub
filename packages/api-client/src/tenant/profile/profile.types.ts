export type TenantProfileLanguage = "en" | "fr" | "zh-CN";
export type TenantProfileUserStatus =
  | "invited"
  | "active"
  | "disabled"
  | "suspended";
export type TenantProfileBranchStatus = "active" | "inactive";

export type TenantProfileRole = {
  code: string;
  name: string;
  branchId: string | null;
};

export type TenantProfileBranch = {
  id: string;
  name: string;
  defaultLanguage: TenantProfileLanguage;
  status: TenantProfileBranchStatus;
};

export type TenantProfile = {
  userId: string;
  tenantId: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  language: TenantProfileLanguage;
  timezone: string;
  email: string | null;
  phone: string | null;
  status: TenantProfileUserStatus;
  roles: TenantProfileRole[];
  tenant: {
    id: string;
    name: string;
    pressingCode: string;
  };
  accessibleBranches: TenantProfileBranch[];
  lastLoginAt: string | null;
  createdAt: string;
  profileUpdatedAt: string | null;
  passwordPolicy: {
    passwordMinLength: number;
    passwordRequiresNumber: boolean;
    passwordRequiresSymbol: boolean;
  };
};

export type UpdateTenantProfileRequest = {
  displayName?: string;
  email?: string;
  phone?: string | null;
  language?: TenantProfileLanguage;
};

export type ChangeTenantProfilePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export type ChangeTenantProfilePasswordResult = {
  passwordChanged: true;
  sessionsRevoked: number;
};

export type ChangeTenantProfilePinRequest = {
  currentPin: string;
  newPin: string;
};

export type ChangeTenantProfilePinResult = {
  pinChanged: true;
  sessionsRevoked: number;
};

export type TenantLoginSession = {
  id: string;
  deviceId: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  signedInAt: string;
  lastActiveAt: string;
  expiresAt: string;
  current: boolean;
};

export type RevokeTenantLoginSessionResult = {
  id: string;
  revoked: true;
  sessionsRevoked: number;
};

export type TenantProfileErrorCode =
  | "TENANT_PROFILE_NOT_FOUND"
  | "TENANT_PROFILE_UPDATE_EMPTY"
  | "CURRENT_PASSWORD_INCORRECT"
  | "NEW_PASSWORD_UNCHANGED"
  | "PASSWORD_POLICY_VIOLATION"
  | "TENANT_PROFILE_EMAIL_CONFLICT"
  | "TENANT_LOGIN_SESSION_NOT_FOUND"
  | "TENANT_CURRENT_SESSION_REVOKE_FORBIDDEN"
  | "TENANT_PROFILE_CONFLICT";
