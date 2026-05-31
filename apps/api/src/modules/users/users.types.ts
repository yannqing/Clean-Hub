import type { AuthContext } from "../auth/auth.types.js";

export type UserListScope = "saas" | "tenant";

export type UserListInput = {
  scope: UserListScope;
  tenantId?: string;
  q?: string;
  status?: "invited" | "active" | "disabled" | "suspended";
  limit: number;
  offset: number;
};

export type UserListItem = {
  id: string;
  tenantId: string | null;
  email: string | null;
  displayName: string;
  role: string;
  roles: string[];
  branchIds: string[];
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
};

export type TenantUserDetail = UserListItem & {
  phone: string | null;
  language: string;
  timezone: string;
  updatedAt: string;
};

export type TenantUserAuditSnapshot = {
  displayName: string;
  phone: string | null;
  status: string;
  roles: string[];
  branchIds: string[];
};

export type CreateTenantUserInput = {
  authContext: AuthContext;
  data: {
    displayName: string;
    email?: string;
    phone?: string;
    roleCode: "owner" | "manager";
    branchIds?: string[];
    initialPin: string;
  };
  requestMeta?: { ipAddress?: string; userAgent?: string };
};

export type GetTenantUserInput = {
  authContext: AuthContext;
  userId: string;
};

export type UpdateTenantUserInput = {
  authContext: AuthContext;
  userId: string;
  data: {
    displayName?: string;
    phone?: string | null;
    branchIds?: string[];
  };
  requestMeta?: { ipAddress?: string; userAgent?: string };
};

export type DisableTenantUserInput = {
  authContext: AuthContext;
  userId: string;
  requestMeta?: { ipAddress?: string; userAgent?: string };
};

export type ResetTenantUserPinInput = {
  authContext: AuthContext;
  userId: string;
  requestMeta?: { ipAddress?: string; userAgent?: string };
};

export type ResetTenantUserPinResult = {
  temporaryPin: string;
};

export type CreateTenantOwnerUserInput = {
  tenantId: string;
  displayName: string;
  email?: string;
  phone?: string;
  initialPin: string;
};
