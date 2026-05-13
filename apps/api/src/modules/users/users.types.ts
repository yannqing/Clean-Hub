export type UserListScope = "saas" | "tenant";
export type UserType = "saas" | "tenant";
export type UserStatus = "invited" | "active" | "disabled" | "suspended";

export type UserListInput = {
  scope: UserListScope;
  tenantId?: string;
  q?: string;
  status?: UserStatus;
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

export type SaasUserListInput = {
  q?: string;
  status?: UserStatus;
  limit: number;
  offset: number;
};

export type SaasUserListItem = {
  id: string;
  tenantId: string | null;
  userType: UserType;
  email: string | null;
  phone: string | null;
  displayName: string;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasUserListResult = {
  items: SaasUserListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type CreateSaasUserInput = {
  tenantId?: string;
  userType: UserType;
  email?: string;
  phone?: string;
  displayName: string;
  password: string;
  status: UserStatus;
};

export type UpdateSaasUserInput = {
  tenantId?: string | null;
  userType?: UserType;
  email?: string | null;
  phone?: string | null;
  displayName?: string;
  password?: string;
  status?: UserStatus;
};
