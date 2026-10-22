import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type TenantUserStatus = "invited" | "active" | "disabled" | "suspended";
export type TenantUserRoleCode = "owner" | "manager" | "cashier";
export type ManagedTenantUserRoleCode = Exclude<TenantUserRoleCode, "owner">;

export type ListTenantUsersQuery = {
  q?: string;
  status?: TenantUserStatus;
  roleCode?: TenantUserRoleCode;
  branchId?: string;
  limit: number;
  offset: number;
};

export type TenantUserListItem = {
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

export type TenantUserDetail = TenantUserListItem & {
  language: string;
  timezone: string;
  updatedAt: string;
};

export type TenantUserAuditSnapshot = {
  email: string | null;
  phone: string | null;
  displayName: string;
  role: TenantUserRoleCode | "unassigned";
  status: string;
  branchIds: string[];
};

type TenantUserRequestInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
};

export type ListTenantUsersInput = TenantUserRequestInput & {
  query: ListTenantUsersQuery;
};

export type GetTenantUserInput = TenantUserRequestInput & {
  userId: string;
};

export type CreateTenantUserInput = TenantUserRequestInput & {
  data: {
    displayName: string;
    email?: string;
    phone?: string;
    roleCode: ManagedTenantUserRoleCode;
    branchId: string;
    password?: string;
    pin: string;
    language: "en" | "fr" | "zh-CN";
  };
};

export type UpdateTenantUserInput = TenantUserRequestInput & {
  userId: string;
  data: {
    displayName?: string;
    email?: string;
    phone?: string | null;
    roleCode?: ManagedTenantUserRoleCode;
    branchId?: string;
    password?: string;
    language?: "en" | "fr" | "zh-CN";
    timezone?: string;
  };
};

export type UpdateTenantUserStatusInput = TenantUserRequestInput & {
  userId: string;
  data: {
    status: "active" | "disabled";
    reason: string;
  };
};

export type DeleteTenantUserInput = TenantUserRequestInput & {
  userId: string;
  data: {
    reason: string;
  };
};

export type ResetTenantUserPinInput = TenantUserRequestInput & {
  userId: string;
  data: {
    pin: string;
    reason: string;
  };
};

export type ResetTenantUserPasswordInput = TenantUserRequestInput & {
  userId: string;
  data: {
    password: string;
    reason: string;
  };
};
