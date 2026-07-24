import type {
  TenantProductOverview,
  TenantProductOverviewQuery,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

export async function getTenantProductOverviewQuery(
  query: TenantProductOverviewQuery = {},
): Promise<TenantProductOverview> {
  return webAdminApi.tenant.products.overview(query);
}
