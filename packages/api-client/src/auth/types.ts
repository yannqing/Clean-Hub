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
  /** Tenant-wide interface language. Every tenant page follows this value. */
  language?: "en" | "fr" | "zh-CN";
  /** Tenant-wide business timezone. Every branch inherits this value. */
  timezone?: string;
  terminalId?: string;
  terminalBranchId?: string;
  terminalDeviceId?: string;
  terminalCredentialVersion?: number;
  accessTokenExpiresAt: string;
};

export type LoginRequest = {
  identifier: string;
  password: string;
  deviceId?: string;
};

export type AuthPosPinLoginRequest = {
  pin: string;
  deviceId: string;
};

export type PosBootstrapStatus =
  | "unconfigured"
  | "admin_setup_required"
  | "enrolled"
  | "disabled"
  | "credential_lost"
  | "ready_for_pin";

export type PosBootstrapRequest = {
  deviceId: string;
};

export type PosBootstrapResponse = {
  status: PosBootstrapStatus;
  deviceId: string;
  requiresAdminLogin: boolean;
  canEnroll: boolean;
  terminal: {
    id: string;
    label: string | null;
    status: "active" | "inactive";
    branchId: string;
  } | null;
  tenant: {
    id: string;
    name: string;
    code: string;
  } | null;
  branch: {
    id: string;
    name: string;
  } | null;
};

export type LoginResponse = {
  authContext: AuthContext;
};

export type RefreshResponse = {
  authContext: AuthContext;
};
