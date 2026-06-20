import type { ApiClient, QueryParams } from "../../types";
import type { AuditLogDetail, AuditLogListResult } from "./audit-logs.types";

export function createSaasAuditLogsApi(client: ApiClient) {
  return {
    list: (query?: QueryParams) =>
      client.get<AuditLogListResult>("/saas/audit-logs", { query }),
    get: (logId: string) =>
      client.get<AuditLogDetail>(`/saas/audit-logs/${logId}`),
  };
}
