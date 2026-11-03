import "server-only";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

export async function getPendingTasksQuery(query?: { branchId?: string }) {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.workspace.getPendingTasks(query, options);
}
