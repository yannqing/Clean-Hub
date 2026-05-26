import { apiClient } from "@/lib/api-client";

import type { TenantAuditLogDetail } from "../types";

export async function getTenantAuditLogDetailQuery(
  logId: string,
): Promise<TenantAuditLogDetail> {
  return apiClient<TenantAuditLogDetail>(`/tenant/audit-logs/${logId}`);
}
