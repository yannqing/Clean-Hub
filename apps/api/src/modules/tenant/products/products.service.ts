import { getDb, type Database } from "@cleanhub/db";

import {
  assertActiveTenant,
  requireFeatureEnabled,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { resolveAllowedBranchIds } from "../../auth/branch-scope.helper.js";
import type { AuthContext } from "../../auth/auth.types.js";
import {
  findTenantProductOverview,
  findTenantProducts,
} from "./products.repository.js";
import type {
  TenantProductListQuery,
  TenantProductListResponse,
  TenantProductOverview,
  TenantProductOverviewQuery,
  TenantProductRepositoryScope,
} from "./products.types.js";

async function resolveProductAccess(
  authContext: AuthContext,
  db: Database,
): Promise<TenantProductRepositoryScope> {
  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);
  await requireFeatureEnabled(authContext, "retail", db);

  const branchScope = await resolveAllowedBranchIds(authContext, db);

  return {
    tenantId: authContext.tenantId!,
    allowedBranchIds: branchScope === "all" ? undefined : branchScope,
  };
}

export async function listTenantProducts(
  authContext: AuthContext,
  query: TenantProductListQuery,
  db: Database = getDb(),
): Promise<TenantProductListResponse> {
  const scope = await resolveProductAccess(authContext, db);

  return findTenantProducts(db, {
    ...query,
    ...scope,
  });
}

export async function getTenantProductOverview(
  authContext: AuthContext,
  query: TenantProductOverviewQuery,
  db: Database = getDb(),
): Promise<TenantProductOverview> {
  const scope = await resolveProductAccess(authContext, db);

  return findTenantProductOverview(db, {
    ...query,
    ...scope,
  });
}
