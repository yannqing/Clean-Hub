import type { QueryParams } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import type { TenantListResponse } from "../types";

export async function getTenantListQuery(
  query?: QueryParams,
): Promise<TenantListResponse> {
  return webAdminApi.saas.tenants.list(query);
}
