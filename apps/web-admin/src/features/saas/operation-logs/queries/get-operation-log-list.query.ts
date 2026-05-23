import { webAdminApi } from "@/lib/api-client";

import type { OperationLogListItem, OperationLogListQuery } from "../types";

export async function getOperationLogListQuery(
  query?: OperationLogListQuery,
): Promise<OperationLogListItem[]> {
  return webAdminApi.saas.operationLogs.list(query);
}
