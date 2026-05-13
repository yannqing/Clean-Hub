import type { ApiClient, QueryParams } from "../types";
import type { AuditLogSummary } from "./audit-logs.types";

export function createSaasAuditLogsApi(client: ApiClient) {
  return {
    list: (query?: QueryParams) =>
      client.get<AuditLogSummary[]>("/saas/audit-logs", { query }),
  };
}
