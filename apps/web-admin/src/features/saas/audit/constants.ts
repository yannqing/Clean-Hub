export const auditEventCategoryOptions = [
  { label: "Auth", value: "auth" },
  { label: "SaaS Platform", value: "saas_platform" },
  { label: "SaaS Tenant", value: "saas_tenant" },
  { label: "SaaS User", value: "saas_user" },
] as const satisfies ReadonlyArray<{ label: string; value: string }>;
