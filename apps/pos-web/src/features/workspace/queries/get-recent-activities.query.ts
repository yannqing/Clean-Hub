import "server-only";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

export async function getRecentActivitiesQuery(query?: {
  branchId?: string;
  limit?: number;
}) {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.workspace.getRecentActivities(query, options);
}
