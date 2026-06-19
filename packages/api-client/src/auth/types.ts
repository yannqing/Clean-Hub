export type AdminRole =
  | "super_admin"
  | "support"
  | "owner"
  | "manager"
  | "cashier";

export type AuthContext = {
  userId: string;
  displayName: string;
  tenantId: string | null;
  branchIds: string[];
  role: AdminRole;
  roles: string[];
  permissions: string[];
  accessTokenExpiresAt: string;
};

export type LoginRequest = {
  identifier: string;
  password: string;
  tenantCode?: string;
  deviceId?: string;
};

export type LoginResponse = {
  authContext: AuthContext;
};

export type RefreshResponse = {
  authContext: AuthContext;
};
