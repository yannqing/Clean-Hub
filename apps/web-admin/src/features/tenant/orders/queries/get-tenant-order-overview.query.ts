import type {
  TenantOrderOverview,
  TenantOrderOverviewQuery,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

export async function getTenantOrderOverviewQuery(
  query: TenantOrderOverviewQuery = { period: "all" },
): Promise<TenantOrderOverview> {
  return webAdminApi.tenant.orders.overview(query);
}
