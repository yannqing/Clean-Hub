import type {
  PosOrderOverview,
  PosOrderOverviewQuery,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

export async function getTenantOrderOverviewQuery(
  query: PosOrderOverviewQuery = { period: "all" },
): Promise<PosOrderOverview> {
  return webAdminApi.pos.orders.overview(query);
}
