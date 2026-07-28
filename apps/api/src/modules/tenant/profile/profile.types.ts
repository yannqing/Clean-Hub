import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

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

export type TenantProfileRequestInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: TData;
};

export type TenantProfileRecord = Omit<TenantProfile, "passwordPolicy">;

export type TenantProfileMutableFields = Pick<
  TenantProfile,
  "displayName" | "language"
>;
