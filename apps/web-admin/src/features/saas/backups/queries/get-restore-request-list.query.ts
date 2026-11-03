import { webAdminApi } from "@/lib/api-client";

import type { RestoreRequest, RestoreRequestListQuery } from "../types";

export async function getRestoreRequestListQuery(
  query?: RestoreRequestListQuery,
): Promise<RestoreRequest[]> {
  return webAdminApi.saas.restoreRequests.list(query);
}
