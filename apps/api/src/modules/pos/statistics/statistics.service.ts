import { type Database, getDb } from "@cleanhub/db";
import type { AuthContext } from "../../auth/auth.types.js";
import {
  requirePosBranchAccess,
  requirePosTenantId,
  resolvePosBranchScope,
} from "../access-control.helper.js";
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
// Overview
// ---------------------------------------------------------------------------

export async function getPosStatisticsOverview(
  authContext: AuthContext,
  query: { period?: PosStatisticsPeriod; branchId?: string },
  db: Database = getDb(),
): Promise<PosStatisticsOverview> {
  const tenantId = requirePosTenantId(authContext);
  if (query.branchId) {
    requirePosBranchAccess(authContext, query.branchId);
  }

  return findStatisticsOverview(db, {
    tenantId,
    allowedBranchIds: resolvePosBranchScope(authContext),
    branchId: query.branchId,
    period: query.period,
    timeZone: authContext.timezone ?? "UTC",
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
  const tenantId = requirePosTenantId(authContext);
  if (query.branchId) {
    requirePosBranchAccess(authContext, query.branchId);
  }

  return findTicketStatisticsDetail(db, {
    tenantId,
    allowedBranchIds: resolvePosBranchScope(authContext),
    branchId: query.branchId,
    period: query.period,
    timeZone: authContext.timezone ?? "UTC",
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
  const tenantId = requirePosTenantId(authContext);
  if (query.branchId) {
    requirePosBranchAccess(authContext, query.branchId);
  }

  return findOrderStatisticsDetail(db, {
    tenantId,
    allowedBranchIds: resolvePosBranchScope(authContext),
    branchId: query.branchId,
    period: query.period,
    timeZone: authContext.timezone ?? "UTC",
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
  const tenantId = requirePosTenantId(authContext);
  if (query.branchId) {
    requirePosBranchAccess(authContext, query.branchId);
  }

  return findCustomerStatistics(db, {
    tenantId,
    allowedBranchIds: resolvePosBranchScope(authContext),
    branchId: query.branchId,
    timeZone: authContext.timezone ?? "UTC",
  });
}
