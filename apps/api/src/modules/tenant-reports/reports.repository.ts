import { and, eq, isNull } from "drizzle-orm";

import {
  tenantFeatureFlags,
  tenants,
  type Database,
} from "@cleanhub/db";

import type { ReportSummary, ReportSummaryInput } from "./reports.types.js";

export async function findTenantReportAccessById(
  db: Database,
  tenantId: string,
): Promise<{ status: "active" | "suspended" | "disabled"; hasFeatureFlags: boolean } | null> {
  const rows = await db
    .select({
      status: tenants.status,
      featureFlagsTenantId: tenantFeatureFlags.tenantId,
    })
    .from(tenants)
    .leftJoin(tenantFeatureFlags, eq(tenantFeatureFlags.tenantId, tenants.id))
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
    .limit(1);

  const row = rows[0];

  return row
    ? {
        status: row.status,
        hasFeatureFlags: Boolean(row.featureFlagsTenantId),
      }
    : null;
}

export async function getTenantReportSummaryRecord(
  _db: Database,
  input: ReportSummaryInput & { tenantId: string },
): Promise<ReportSummary> {
  return {
    grossSales: 0,
    orderCount: 0,
    pendingPickupCount: 0,
    inProgressCount: 0,
    paymentBreakdown: {
      cash: 0,
      mobile: 0,
      card: 0,
      other: 0,
    },
    filters: {
      from: input.from ?? null,
      to: input.to ?? null,
      branchId: input.branchId ?? null,
    },
  };
}
