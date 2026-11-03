import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  OperationLogDetail,
  OperationLogListQuery,
  OperationLogListResult,
} from "./operation-logs.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body">;

export function createSaasOperationLogsApi(client: ApiClient) {
  return {
    list: (query?: OperationLogListQuery, options: RequestOptions = {}) =>
      client.get<OperationLogListResult>("/saas/operation-logs", {
        ...options,
        query,
      }),
    get: (logId: string, options: RequestOptions = {}) =>
      client.get<OperationLogDetail>(
        `/saas/operation-logs/${encodeURIComponent(logId)}`,
        options,
      ),
  };
}
