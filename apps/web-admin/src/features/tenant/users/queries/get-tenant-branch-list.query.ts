import type { ApiRequestOptions, BranchSummary } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

export async function getTenantBranchListQuery(
  options: Omit<ApiRequestOptions, "method" | "body" | "query"> = {},
): Promise<BranchSummary[]> {
  return webAdminApi.tenant.branches.list({ limit: 100, offset: 0 }, options);
}
