import { getDb, type Database } from "@cleanhub/db";

import { AuthError } from "../auth/auth.errors.js";
import type { AuthContext } from "../auth/auth.types.js";
import {
  assertActiveTenant,
  assertTenantContext,
  requireTenantRole,
} from "../auth/permission.helper.js";
import {
  findTenantReportAccessById,
  getTenantReportSummaryRecord,
} from "./reports.repository.js";
import type { ReportSummary, ReportSummaryInput } from "./reports.types.js";

function getTenantId(authContext: AuthContext): string {
  assertTenantContext(authContext);

  if (!authContext.tenantId) {
    throw new AuthError("FORBIDDEN", "Tenant context is required.");
  }

  return authContext.tenantId;
}

async function requireTenantReportAccess(
  db: Database,
  tenantId: string,
): Promise<void> {
  const access = await findTenantReportAccessById(db, tenantId);

  if (!access || access.status !== "active") {
    throw new AuthError("FORBIDDEN", "Tenant is not active.");
  }

  if (!access.hasFeatureFlags) {
    throw new AuthError(
      "FEATURE_DISABLED",
      "Tenant feature flags are not configured.",
    );
  }
}

export async function getTenantReportSummary(
  authContext: AuthContext,
  input: ReportSummaryInput,
  db: Database = getDb(),
): Promise<ReportSummary> {
  const tenantId = getTenantId(authContext);

  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);
  await requireTenantReportAccess(db, tenantId);

  return getTenantReportSummaryRecord(db, {
    ...input,
    tenantId,
  });
}
