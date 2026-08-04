import { getDb, type Database } from "@cleanhub/db";

import { resolveAllowedBranchIds } from "../../auth/branch-scope.helper.js";
import { AuthError } from "../../auth/auth.errors.js";
import {
  assertActiveTenant,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import {
  countTenantOrders,
  findTenantOrderOverview,
  findTenantOrders,
} from "./orders.repository.js";
import type {
  TenantOrderListInput,
  TenantOrderListResponse,
  TenantOrderOverview,
  TenantOrderOverviewQuery,
} from "./orders.types.js";

async function resolveTenantOrderScope(
  authContext: TenantOrderListInput["authContext"],
  branchId: string | undefined,
  db: Database,
): Promise<{ tenantId: string; allowedBranchIds?: string[] }> {
  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);

  const branchScope = await resolveAllowedBranchIds(authContext, db);
  if (
    branchId &&
    branchScope !== "all" &&
    !branchScope.includes(branchId)
  ) {
    throw new AuthError(
      "FORBIDDEN",
      "User cannot access the requested branch.",
    );
  }

  return {
    tenantId: authContext.tenantId!,
    allowedBranchIds: branchScope === "all" ? undefined : branchScope,
  };
}

export async function listTenantOrders(
  input: TenantOrderListInput,
  db: Database = getDb(),
): Promise<TenantOrderListResponse> {
  const scope = await resolveTenantOrderScope(
    input.authContext,
    input.query.branchId,
    db,
  );
  const repositoryInput = {
    ...scope,
    query: input.query,
  };
  const [data, total] = await Promise.all([
    findTenantOrders(db, repositoryInput),
    countTenantOrders(db, repositoryInput),
  ]);

  return { data, total };
}

export async function getTenantOrderOverview(
  authContext: TenantOrderListInput["authContext"],
  query: TenantOrderOverviewQuery,
  db: Database = getDb(),
): Promise<TenantOrderOverview> {
  const scope = await resolveTenantOrderScope(
    authContext,
    query.branchId,
    db,
  );

  return findTenantOrderOverview(db, {
    ...scope,
    branchId: query.branchId,
    period: query.period,
    createdAfter: query.createdAfter,
    createdBefore: query.createdBefore,
  });
}
