import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { RestoreRequestListQuery, RestoreRequestListResult } from "../types";

/**
 * List the tenant's restore requests.
 *
 * Target endpoint: `GET /tenant/restore-requests`. The api-client method
 * currently returns an empty result until the backend tenant route exists.
 */
export async function getTenantRestoreRequestListQuery(
  query?: RestoreRequestListQuery,
): Promise<RestoreRequestListResult> {
  return webAdminApi.tenant.backups.listRestoreRequests(
    query,
    await getTenantServerApiRequestOptions(),
  );
}
