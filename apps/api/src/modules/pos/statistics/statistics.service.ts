import { type Database, getDb } from "@cleanhub/db";
import type { AuthContext } from "../../auth/auth.types.js";
import { assertPosContext } from "../../auth/permission.helper.js";
import {
  findCustomerStatistics,
  findOrderStatisticsDetail,
  findStatisticsOverview,
  findTicketStatisticsDetail,
} from "./statistics.repository.js";
import type {
  PosCustomerStatistics,
  PosOrderStatisticsDetail,
  PosStatisticsOverview,
  PosStatisticsPeriod,
  PosTicketStatisticsDetail,
} from "./statistics.types.js";

// ---------------------------------------------------------------------------
// Local helpers (same pattern as orders.service.ts)
// ---------------------------------------------------------------------------

function requirePosContext(authContext: AuthContext): string {
  assertPosContext(authContext);
  return authContext.tenantId!;
}

function resolveListBranchScope(
  authContext: AuthContext,
): string[] | undefined {
  if (authContext.role === "owner" || authContext.role === "manager") {
    return authContext.branchIds.length > 0
      ? authContext.branchIds
      : undefined;
  }
  return authContext.branchIds;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function getPosStatisticsOverview(
  authContext: AuthContext,
  query: { period?: PosStatisticsPeriod; branchId?: string },
  db: Database = getDb(),
): Promise<PosStatisticsOverview> {
  const tenantId = requirePosContext(authContext);

  return findStatisticsOverview(db, {
    tenantId,
    allowedBranchIds: resolveListBranchScope(authContext),
    branchId: query.branchId,
    period: query.period,
  });
}

// ---------------------------------------------------------------------------
// Ticket statistics
// ---------------------------------------------------------------------------

export async function getPosTicketStatistics(
  authContext: AuthContext,
  query: { period?: PosStatisticsPeriod; branchId?: string },
  db: Database = getDb(),
): Promise<PosTicketStatisticsDetail> {
  const tenantId = requirePosContext(authContext);

  return findTicketStatisticsDetail(db, {
    tenantId,
    allowedBranchIds: resolveListBranchScope(authContext),
    branchId: query.branchId,
    period: query.period,
  });
}

// ---------------------------------------------------------------------------
// Order statistics
// ---------------------------------------------------------------------------

export async function getPosOrderStatistics(
  authContext: AuthContext,
  query: { period?: PosStatisticsPeriod; branchId?: string },
  db: Database = getDb(),
): Promise<PosOrderStatisticsDetail> {
  const tenantId = requirePosContext(authContext);

  return findOrderStatisticsDetail(db, {
    tenantId,
    allowedBranchIds: resolveListBranchScope(authContext),
    branchId: query.branchId,
    period: query.period,
  });
}

// ---------------------------------------------------------------------------
// Customer statistics
// ---------------------------------------------------------------------------

export async function getPosCustomerStatistics(
  authContext: AuthContext,
  query: { branchId?: string },
  db: Database = getDb(),
): Promise<PosCustomerStatistics> {
  const tenantId = requirePosContext(authContext);

  return findCustomerStatistics(db, {
    tenantId,
    allowedBranchIds: resolveListBranchScope(authContext),
    branchId: query.branchId,
  });
}
