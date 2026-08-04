import type { Database } from "@cleanhub/db";

import {
  countPosOrders,
  findPosOrderOverview,
  findPosOrders,
} from "../../pos/orders/orders.repository.js";
import type {
  TenantOrderOverview,
  TenantOrderRepositoryListInput,
  TenantOrderRepositoryOverviewInput,
  TenantOrderSummary,
} from "./orders.types.js";

/**
 * Tenant back-office orders use the same commerce read model as POS, but the
 * caller supplies a tenant/branch scope resolved from a non-terminal web
 * session. Keeping this adapter in the tenant module prevents route handlers
 * from crossing into the POS authentication boundary.
 */
export async function findTenantOrders(
  db: Database,
  input: TenantOrderRepositoryListInput,
): Promise<TenantOrderSummary[]> {
  return findPosOrders(db, input);
}

export async function countTenantOrders(
  db: Database,
  input: TenantOrderRepositoryListInput,
): Promise<number> {
  return countPosOrders(db, input);
}

export async function findTenantOrderOverview(
  db: Database,
  input: TenantOrderRepositoryOverviewInput,
): Promise<TenantOrderOverview> {
  return findPosOrderOverview(db, input);
}
