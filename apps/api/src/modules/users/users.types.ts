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
