import type { ApiRequestOptions } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import type { OperationLogDetail } from "../types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export async function getOperationLogDetailQuery(
  logId: string,
  options: RequestOptions = {},
): Promise<OperationLogDetail> {
  return webAdminApi.saas.operationLogs.get(logId, options);
}
