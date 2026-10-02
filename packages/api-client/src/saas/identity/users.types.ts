export type SaasUserStatus = "invited" | "active" | "disabled" | "suspended";
export type SaasUserStats = {
  total: number;
  statusCounts: Record<SaasUserStatus, number>;
};
export type SaasUserLanguage = "en" | "fr" | "zh-CN";
export type SaasUserRoleCode = "super_admin" | "support";

export type CreateSaasUserRequest = {
  email: string;
  phone?: string;
  displayName: string;
  password: string;
  roleCode: SaasUserRoleCode;
  language?: SaasUserLanguage;
};

export type UpdateSaasUserRequest = {
  email?: string;
  phone?: string | null;
  displayName?: string;
  language?: SaasUserLanguage;
  timezone?: string;
};

export type UpdateSaasUserStatusRequest = {
  status: Extract<SaasUserStatus, "active" | "disabled">;
  reason?: string;
};

export type UpdateSaasUserRolesRequest = {
  roleCodes: SaasUserRoleCode[];
};

export type ResetSaasUserPasswordRequest = {
  reason: string;
};

export type ResetSaasUserPasswordResult = {
  temporaryPassword: string;
};

export type SaasUserSummary = {
  id: string;
  tenantId: null;
  email: string | null;
  phone: string | null;
  displayName: string;
  role: string;
  roles: string[];
  status: SaasUserStatus;
  language: string;
  lastLoginAt: string | null;
  createdAt: string;
};

export type SaasUserDetail = SaasUserSummary & {
  avatarUrl: string | null;
  timezone: string;
  updatedAt: string;
};
