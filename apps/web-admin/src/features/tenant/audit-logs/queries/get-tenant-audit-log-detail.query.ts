import { apiClient } from "@/lib/api-client";
import type { ApiRequestOptions } from "@cleanhub/api-client";

import type { TenantAuditLogDetail } from "../types";

export async function getTenantAuditLogDetailQuery(
  logId: string,
  options: Omit<ApiRequestOptions, "method" | "body"> = {},
): Promise<TenantAuditLogDetail> {
  return apiClient<TenantAuditLogDetail>(`/tenant/audit-logs/${logId}`, options);
}
