import type { ApiRequestOptions, TenantUserListQuery, TenantUserSummary } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

export async function getTenantUserListQuery(
  query?: TenantUserListQuery,
  options: Omit<ApiRequestOptions, "method" | "body" | "query"> = {},
): Promise<TenantUserSummary[]> {
  return webAdminApi.tenant.users.list(query, options);
}
