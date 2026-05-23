import type { ApiClient } from "../types";
import type {
  OperationLogListItem,
  OperationLogListQuery,
} from "./operation-logs.types";

export function createSaasOperationLogsApi(client: ApiClient) {
  return {
    list: (query?: OperationLogListQuery) =>
      client.get<OperationLogListItem[]>("/saas/operation-logs", { query }),
  };
}
