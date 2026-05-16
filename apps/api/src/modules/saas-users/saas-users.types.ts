import type { AuthContext } from "../auth/auth.types.js";

export type SaasUserStatus = "invited" | "active" | "disabled" | "suspended";

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
