import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { PointOfSaleOverview, PointOfSaleOverviewQuery } from "../types";

export async function getPointOfSaleOverviewQuery(
  query?: PointOfSaleOverviewQuery,
): Promise<PointOfSaleOverview> {
  return webAdminApi.tenant.posChannel.getOverview(
    query,
    await getTenantServerApiRequestOptions(),
  );
}
