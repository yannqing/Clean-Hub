import { getDb, type Database } from "@cleanhub/db";

import { resolveAllowedBranchIds } from "../../auth/branch-scope.helper.js";
import { AuthError } from "../../auth/auth.errors.js";
import {
  assertActiveTenant,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { findTenantCustomers } from "./customers.repository.js";
import type {
  TenantCustomerListInput,
  TenantCustomerListResponse,
} from "./customers.types.js";

export async function listTenantCustomers(
  input: TenantCustomerListInput,
  db: Database = getDb(),
): Promise<TenantCustomerListResponse> {
  requireTenantRole(input.authContext, ["owner", "manager"]);
  await assertActiveTenant(input.authContext, db);

  const branchScope = await resolveAllowedBranchIds(input.authContext, db);
  if (
    input.query.branchId &&
    branchScope !== "all" &&
    !branchScope.includes(input.query.branchId)
  ) {
    throw new AuthError(
      "FORBIDDEN",
      "User cannot access the requested branch.",
    );
  }

  return findTenantCustomers(db, {
    ...input.query,
    tenantId: input.authContext.tenantId!,
    allowedBranchIds: branchScope === "all" ? undefined : branchScope,
  });
}
