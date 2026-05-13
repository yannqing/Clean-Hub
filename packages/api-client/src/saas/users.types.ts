export type SaasUserStatus = "invited" | "active" | "disabled" | "suspended";
export type SaasManagedUserType = "saas" | "tenant";

export type SaasUserSummary = {
  id: string;
  tenantId: string | null;
  userType: SaasManagedUserType;
  email: string | null;
  phone: string | null;
  displayName: string;
  status: SaasUserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasUserListResponse = {
  items: SaasUserSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type CreateSaasUserRequest = {
  tenantId?: string;
  userType: SaasManagedUserType;
  email?: string;
  phone?: string;
  displayName: string;
  password: string;
  status: SaasUserStatus;
};

export type UpdateSaasUserRequest = {
  tenantId?: string | null;
  userType?: SaasManagedUserType;
  email?: string | null;
  phone?: string | null;
  displayName?: string;
  password?: string;
  status?: SaasUserStatus;
};
