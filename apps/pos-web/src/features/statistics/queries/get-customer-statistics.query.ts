import "server-only";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

export async function getCustomerStatisticsQuery(
  query?: { branchId?: string },
) {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.statistics.getCustomerStatistics(query, options);
}
