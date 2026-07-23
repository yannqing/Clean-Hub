export type LoginScope =
  | {
      tenantCode: undefined;
      userType: "saas";
    }
  | {
      tenantCode: string;
      userType: "tenant";
    };

export function resolveLoginScope(tenantCode?: string): LoginScope {
  const normalizedTenantCode = tenantCode?.trim().toUpperCase() || undefined;

  if (normalizedTenantCode) {
    return {
      tenantCode: normalizedTenantCode,
      userType: "tenant",
    };
  }

  return {
    tenantCode: undefined,
    userType: "saas",
  };
}
