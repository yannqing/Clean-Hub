export const tenantUserRoleOptions = [
  { label: "Owner", value: "owner" },
  { label: "Manager", value: "manager" },
  { label: "Cashier", value: "cashier" },
] as const satisfies ReadonlyArray<{ label: string; value: string }>;

export const tenantUserStatusOptions = [
  { label: "Active", value: "active" },
  { label: "Invited", value: "invited" },
  { label: "Disabled", value: "disabled" },
  { label: "Suspended", value: "suspended" },
] as const satisfies ReadonlyArray<{ label: string; value: string }>;
