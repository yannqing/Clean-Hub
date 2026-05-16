export type SaasUserStatus = "invited" | "active" | "disabled" | "suspended";
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
