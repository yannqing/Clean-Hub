// Re-export the canonical role / permission types so consumers of
// `@cleanhub/api-client` get them from a single source of truth
// (`@cleanhub/domain`) without having to add that package as a direct
// dependency. Keeping the re-export here means `AuthContext` below stays
// strongly typed against the same catalog used by the backend RBAC layer.
export type {
  AdminRole,
  Permission,
  SaasAdminRole,
  TenantRole,
} from "@cleanhub/domain";

import type { AdminRole, Permission } from "@cleanhub/domain";

export type AuthContext = {
  userId: string;
  displayName: string;
  tenantId: string | null;
  branchIds: string[];
  role: AdminRole;
  roles: string[];
  permissions: Permission[];
  terminalId?: string;
  terminalBranchId?: string;
  terminalDeviceId?: string;
  accessTokenExpiresAt: string;
};

export type LoginRequest = {
  identifier: string;
  password: string;
  deviceId?: string;
};

export type AuthPosPinLoginRequest = {
  pin: string;
  tenantCode: string;
  deviceId: string;
};

export type LoginResponse = {
  authContext: AuthContext;
};

export type RefreshResponse = {
  authContext: AuthContext;
};
