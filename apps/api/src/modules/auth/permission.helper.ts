import { eq } from "drizzle-orm";

import {
  getDb,
  tenantFeatureFlags,
  tenants,
  type Database,
} from "@cleanhub/db";

import { AuthError } from "./auth.errors.js";
import type { AdminRole, AuthContext } from "./auth.types.js";

export type SaasRole = Extract<AdminRole, "super_admin" | "support">;
export type TenantRole = Extract<AdminRole, "owner" | "manager">;
export type TenantFeature =
  | "laundry"
  | "car_wash"
  | "retail"
  | "delivery"
  | "notifications";

const SAAS_ROLES: SaasRole[] = ["super_admin", "support"];
const TENANT_ROLES: TenantRole[] = ["owner", "manager"];

const TENANT_FEATURE_COLUMNS: Record<
  TenantFeature,
  keyof Pick<
    typeof tenantFeatureFlags.$inferSelect,
    | "laundryEnabled"
    | "carWashEnabled"
    | "retailProductsEnabled"
    | "deliveryEnabled"
    | "notificationsEnabled"
  >
> = {
  laundry: "laundryEnabled",
  car_wash: "carWashEnabled",
  retail: "retailProductsEnabled",
  delivery: "deliveryEnabled",
  notifications: "notificationsEnabled",
};

export function assertSaasContext(authContext: AuthContext): void {
  if (!SAAS_ROLES.includes(authContext.role as SaasRole)) {
    throw new AuthError("FORBIDDEN", "User cannot access SaaS resources.");
  }
}

export function requireSaasRole(
  authContext: AuthContext,
  allowedRoles: SaasRole[],
): void {
  assertSaasContext(authContext);

  if (!allowedRoles.includes(authContext.role as SaasRole)) {
    throw new AuthError("FORBIDDEN", "User does not have enough permission.");
  }
}

export function requireSuperAdmin(authContext: AuthContext): void {
  requireSaasRole(authContext, ["super_admin"]);
}

export function hasPermission(
  authContext: AuthContext,
  permissionCode: string,
): boolean {
  return authContext.permissions.includes(permissionCode);
}

export function requirePermission(
  authContext: AuthContext,
  permissionCode: string,
): void {
  if (!hasPermission(authContext, permissionCode)) {
    throw new AuthError("FORBIDDEN", "User does not have enough permission.");
  }
}

export function requireAnyPermission(
  authContext: AuthContext,
  permissionCodes: string[],
): void {
  if (!permissionCodes.some((code) => hasPermission(authContext, code))) {
    throw new AuthError("FORBIDDEN", "User does not have enough permission.");
  }
}

export function assertTenantContext(authContext: AuthContext): void {
  if (!authContext.tenantId) {
    throw new AuthError("FORBIDDEN", "User cannot access tenant resources.");
  }

  if (!TENANT_ROLES.includes(authContext.role as TenantRole)) {
    throw new AuthError("FORBIDDEN", "User cannot access tenant resources.");
  }
}

export function requireTenantRole(
  authContext: AuthContext,
  allowedRoles: TenantRole[],
): void {
  assertTenantContext(authContext);

  if (!allowedRoles.includes(authContext.role as TenantRole)) {
    throw new AuthError("FORBIDDEN", "User does not have enough permission.");
  }
}

export async function assertActiveTenant(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<void> {
  assertTenantContext(authContext);

  const rows = await db
    .select({ status: tenants.status })
    .from(tenants)
    .where(eq(tenants.id, authContext.tenantId!))
    .limit(1);

  const tenant = rows[0];

  if (!tenant || tenant.status !== "active") {
    throw new AuthError("FORBIDDEN", "Tenant is not active.");
  }
}

export async function requireFeatureEnabled(
  authContext: AuthContext,
  feature: TenantFeature,
  db: Database = getDb(),
): Promise<void> {
  assertTenantContext(authContext);

  const rows = await db
    .select({
      laundryEnabled: tenantFeatureFlags.laundryEnabled,
      carWashEnabled: tenantFeatureFlags.carWashEnabled,
      retailProductsEnabled: tenantFeatureFlags.retailProductsEnabled,
      deliveryEnabled: tenantFeatureFlags.deliveryEnabled,
      notificationsEnabled: tenantFeatureFlags.notificationsEnabled,
    })
    .from(tenantFeatureFlags)
    .where(eq(tenantFeatureFlags.tenantId, authContext.tenantId!))
    .limit(1);

  const flags = rows[0];

  if (!flags || !flags[TENANT_FEATURE_COLUMNS[feature]]) {
    throw new AuthError(
      "FEATURE_DISABLED",
      `Feature "${feature}" is not enabled for this tenant.`,
    );
  }
}
