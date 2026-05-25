import { webAdminApi } from "@/lib/api-client";

import type { AuditLogDetail } from "../types";

export async function getSaasAuditLogDetailQuery(
  logId: string,
): Promise<AuditLogDetail> {
  return webAdminApi.saas.getAuditLog(logId);
}
