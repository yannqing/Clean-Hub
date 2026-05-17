import type { AuthContext, AuthRequestMeta } from "../auth/auth.types.js";

export type SaasUserStatus = "invited" | "active" | "disabled" | "suspended";
export type SaasUserLanguage = "en" | "fr" | "zh-CN";
export type SaasUserRoleCode = "super_admin" | "support";

export type SaasRoleListItem = {
  id: string;
  code: SaasUserRoleCode;
  name: string;
  description: string | null;
  status: "active" | "disabled";
  isSystem: boolean;
  permissions: string[];
};

export type ListSaasUsersQuery = {
  q?: string;
  status?: SaasUserStatus;
  limit: number;
  offset: number;
};

export type ListSaasUsersInput = {
  authContext: AuthContext;
  query: ListSaasUsersQuery;
};

export type GetSaasUserDetailInput = {
  authContext: AuthContext;
  userId: string;
};

export type CreateSaasUserRequest = {
  email: string;
  phone?: string;
  displayName: string;
  password: string;
  roleCode: SaasUserRoleCode;
  language?: SaasUserLanguage;
};

export type CreateSaasUserInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: CreateSaasUserRequest & {
    language: SaasUserLanguage;
  };
};

export type UpdateSaasUserRequest = {
  email?: string;
  phone?: string | null;
  displayName?: string;
  language?: SaasUserLanguage;
  timezone?: string;
};

export type UpdateSaasUserInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  userId: string;
  data: UpdateSaasUserRequest;
};

export type UpdateSaasUserStatusRequest = {
  status: Extract<SaasUserStatus, "active" | "disabled">;
};

export type UpdateSaasUserRolesRequest = {
  roleCodes: SaasUserRoleCode[];
};

export type UpdateSaasUserStatusInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  userId: string;
  data: UpdateSaasUserStatusRequest;
};

export type UpdateSaasUserRolesInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  userId: string;
  data: UpdateSaasUserRolesRequest;
};

export type SaasUserListItem = {
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

export type SaasUserDetail = SaasUserListItem & {
  avatarUrl: string | null;
  timezone: string;
  updatedAt: string;
};
