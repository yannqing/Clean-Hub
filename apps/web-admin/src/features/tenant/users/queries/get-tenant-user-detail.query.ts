import type { ApiRequestOptions, TenantUserDetail } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

export async function getTenantUserDetailQuery(
  userId: string,
  options: Omit<ApiRequestOptions, "method" | "body" | "query"> = {},
): Promise<TenantUserDetail> {
  return webAdminApi.tenant.users.get(userId, options);
}
