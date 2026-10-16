import type { Database } from "@cleanhub/db";

import {
  countPosOrders,
  findPosOrderDetail,
  findPosOrderOverview,
  findPosOrders,
  listPaymentTransactions,
} from "../../pos/orders/orders.repository.js";
import type { PosOrderDetail } from "../../pos/orders/orders.types.js";
import type {
  TenantOrderOverview,
  TenantOrderPaymentTransaction,
  TenantOrderRepositoryDetailInput,
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

export async function findTenantOrderDetail(
  db: Database,
  input: TenantOrderRepositoryDetailInput,
): Promise<PosOrderDetail | null> {
  return findPosOrderDetail(db, input);
}

export async function findTenantOrderPaymentTransactions(
  db: Database,
  input: TenantOrderRepositoryDetailInput,
): Promise<TenantOrderPaymentTransaction[]> {
  return listPaymentTransactions(db, input);
}

export async function findTenantOrderOverview(
  db: Database,
  input: TenantOrderRepositoryOverviewInput,
): Promise<TenantOrderOverview> {
  return findPosOrderOverview(db, input);
}
