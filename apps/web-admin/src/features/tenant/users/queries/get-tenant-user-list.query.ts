import { webAdminApi } from "@/lib/api-client";

import type { TenantUserSummary } from "../types";

export type TenantUserListQuery = {
  limit?: number;
  offset?: number;
  q?: string;
  status?: string;
};

export async function getTenantUserListQuery(
  query?: TenantUserListQuery,
): Promise<TenantUserSummary[]> {
  return webAdminApi.tenant.users.list(query);
}
