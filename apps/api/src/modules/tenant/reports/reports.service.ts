import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext } from "../../auth/auth.types.js";
import {
  assertActiveTenant,
  assertTenantContext,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { getTenantReportSummaryRecord } from "./reports.repository.js";
import type { ReportSummary, ReportSummaryInput } from "./reports.types.js";

function getTenantId(authContext: AuthContext): string {
  assertTenantContext(authContext);

  return authContext.tenantId!;
}

export async function getTenantReportSummary(
  authContext: AuthContext,
  input: ReportSummaryInput,
  db: Database = getDb(),
): Promise<ReportSummary> {
  const tenantId = getTenantId(authContext);

  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);

  return getTenantReportSummaryRecord(db, {
    ...input,
    tenantId,
  });
}
