import { apiClient } from "@/lib/api-client";

import type {
  TenantAuditLogListFilters,
  TenantAuditLogListResult,
} from "../types";

export async function getTenantAuditLogListQuery(
  filters: TenantAuditLogListFilters = {},
): Promise<TenantAuditLogListResult> {
  return apiClient<TenantAuditLogListResult>("/tenant/audit-logs", {
    query: {
      ...filters,
      limit: filters.limit ?? 50,
      offset: filters.offset ?? 0,
    },
  });
}
