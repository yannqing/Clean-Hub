import { webAdminApi } from "@/lib/api-client";

import type { AuditLogListQuery, AuditLogListResult } from "../types";

export async function getSaasAuditLogListQuery(
  query?: AuditLogListQuery,
): Promise<AuditLogListResult> {
  return webAdminApi.saas.listAuditLogs(query);
}
