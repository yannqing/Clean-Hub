export type AdminScope = "saas" | "tenant";

export type Permission =
  | "saas:tenant:read"
  | "saas:tenant:write"
  | "saas:user:manage"
  | "saas:audit:read"
  | "tenant:branch:manage"
  | "tenant:user:manage"
  | "tenant:catalog:manage"
  | "tenant:hardware:manage"
  | "tenant:report:read";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  scope: AdminScope;
  tenantId?: string;
  branchIds: string[];
  permissions: Permission[];
};
