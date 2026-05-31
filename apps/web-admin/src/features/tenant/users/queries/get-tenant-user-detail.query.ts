import { webAdminApi } from "@/lib/api-client";

import type { TenantUserDetail } from "../types";

export async function getTenantUserDetailQuery(
  userId: string,
): Promise<TenantUserDetail> {
  return webAdminApi.tenant.users.get(userId);
}
