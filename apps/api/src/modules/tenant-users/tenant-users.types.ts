import type { AuthContext } from "../auth/auth.types.js";

export type TenantUserStatus = "invited" | "active" | "disabled" | "suspended";
export type TenantUserRoleCode = "owner" | "manager" | "cashier";

export type ListTenantUsersQuery = {
  q?: string;
  status?: TenantUserStatus;
  limit: number;
  offset: number;
};

export type TenantUserListItem = {
  id: string;
  tenantId: string;
  email: string | null;
  displayName: string;
  role: string;
  roles: string[];
  branchIds: string[];
  status: TenantUserStatus;
  lastLoginAt: string | null;
  createdAt: string;
};

export type TenantUserDetail = TenantUserListItem & {
  phone: string | null;
  language: string;
  timezone: string;
  updatedAt: string;
};

export type TenantUserAuditSnapshot = {
  email: string | null;
  phone: string | null;
  displayName: string;
  status: string;
  branchIds: string[];
};

export type ListTenantUsersInput = {
  authContext: AuthContext;
  query: ListTenantUsersQuery;
};

export type GetTenantUserInput = {
  authContext: AuthContext;
  userId: string;
};

export type CreateTenantUserInput = {
  authContext: AuthContext;
  displayName: string;
  email?: string;
  phone?: string;
  roleCode: TenantUserRoleCode;
  branchIds?: string[];
  initialPin: string;
  ipAddress?: string;
  userAgent?: string;
};

export type UpdateTenantUserInput = {
  authContext: AuthContext;
  userId: string;
  displayName?: string;
  phone?: string | null;
  branchIds?: string[];
  roleCode?: TenantUserRoleCode;
  ipAddress?: string;
  userAgent?: string;
};

export type DisableTenantUserInput = {
  authContext: AuthContext;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
};

export type EnableTenantUserInput = {
  authContext: AuthContext;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
};

export type ResetTenantUserPinInput = {
  authContext: AuthContext;
  userId: string;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
};

export type ResetTenantUserPinResult = {
  temporaryPin: string;
};
