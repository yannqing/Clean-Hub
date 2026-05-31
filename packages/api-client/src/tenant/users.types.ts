export type TenantUserStatus = "invited" | "active" | "disabled" | "suspended";

export type TenantUserSummary = {
  id: string;
  tenantId: string | null;
  email: string | null;
  displayName: string;
  role: string;
  roles: string[];
  branchIds: string[];
  status: TenantUserStatus;
  lastLoginAt: string | null;
  createdAt: string;
};

export type TenantUserDetail = TenantUserSummary & {
  phone: string | null;
  language: string;
  timezone: string;
  updatedAt: string;
};

export type CreateTenantUserRequest = {
  displayName: string;
  email?: string;
  phone?: string;
  roleCode: "owner" | "manager";
  branchIds?: string[];
  initialPin: string;
};

export type UpdateTenantUserRequest = {
  displayName?: string;
  phone?: string | null;
  branchIds?: string[];
};

export type ResetTenantUserPinResult = {
  temporaryPin: string;
};
