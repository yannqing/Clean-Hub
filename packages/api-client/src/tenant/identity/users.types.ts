export type TenantUserStatus = "invited" | "active" | "disabled" | "suspended";
export type TenantUserRoleCode = "owner" | "manager" | "cashier";
export type ManagedTenantUserRoleCode = "manager" | "cashier";

export type TenantUserSummary = {
  id: string;
  tenantId: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  role: TenantUserRoleCode | "unassigned";
  roles: TenantUserRoleCode[];
  branchIds: string[];
  status: TenantUserStatus;
  lastLoginAt: string | null;
  createdAt: string;
};

export type TenantUserDetail = TenantUserSummary & {
  language: string;
  timezone: string;
  updatedAt: string;
};

export type TenantUserListQuery = {
  q?: string;
  status?: TenantUserStatus;
  roleCode?: TenantUserRoleCode;
  branchId?: string;
  limit?: number;
  offset?: number;
};

export type CreateTenantUserRequest = {
  displayName: string;
  email?: string;
  phone?: string;
  roleCode: ManagedTenantUserRoleCode;
  branchId: string;
  password?: string;
  pin: string;
  language?: "en" | "fr" | "zh-CN";
};

export type UpdateTenantUserRequest = {
  displayName?: string;
  email?: string;
  phone?: string | null;
  roleCode?: ManagedTenantUserRoleCode;
  branchId?: string;
  password?: string;
  language?: "en" | "fr" | "zh-CN";
  timezone?: string;
};

export type UpdateTenantUserStatusRequest = {
  status: "active" | "disabled";
  reason: string;
};

export type ResetTenantUserPinRequest = {
  pin: string;
  reason: string;
};

export type ResetTenantUserPasswordRequest = {
  password: string;
  reason: string;
};
