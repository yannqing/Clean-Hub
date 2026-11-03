import type { ApiRequestOptions } from "@cleanhub/api-client";

import { apiClient } from "@/lib/api-client";

import type { AuditLogDetail } from "../types";

export async function getSaasAuditLogDetailQuery(
  logId: string,
  options: Omit<ApiRequestOptions, "method" | "body"> = {},
): Promise<AuditLogDetail> {
  return apiClient<AuditLogDetail>(
    `/saas/audit-logs/${encodeURIComponent(logId)}`,
    options,
  );
}
