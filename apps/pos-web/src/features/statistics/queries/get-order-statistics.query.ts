import "server-only";

import type { PosStatisticsPeriod } from "@cleanhub/api-client";
import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

export async function getOrderStatisticsQuery(query?: {
  period?: PosStatisticsPeriod;
  branchId?: string;
}) {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.statistics.getOrderStatistics(query, options);
}
