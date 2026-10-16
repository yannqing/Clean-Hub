import type { ApiClient, QueryParams } from "../../types";
import type {
  TenantAuditLogDetail,
  TenantAuditLogListResult,
} from "./audit-logs.types";

export function createTenantAuditLogsApi(client: ApiClient) {
  return {
    list: (query?: QueryParams) =>
      client.get<TenantAuditLogListResult>("/tenant/audit-logs", { query }),
    get: (logId: string) =>
      client.get<TenantAuditLogDetail>(`/tenant/audit-logs/${logId}`),
  };
}
