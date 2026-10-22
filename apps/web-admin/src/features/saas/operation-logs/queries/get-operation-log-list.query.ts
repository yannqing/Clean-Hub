import { webAdminApi } from "@/lib/api-client";

import type { OperationLogListQuery, OperationLogListResult } from "../types";

export async function getOperationLogListQuery(
  query?: OperationLogListQuery,
): Promise<OperationLogListResult> {
  return webAdminApi.saas.operationLogs.list(query);
}
