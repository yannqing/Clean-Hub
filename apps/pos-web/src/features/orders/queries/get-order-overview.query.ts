import "server-only";

import type {
  PosOrderOverview,
  PosOrderOverviewQuery,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

export async function getOrderOverviewQuery(
  query?: PosOrderOverviewQuery,
): Promise<PosOrderOverview> {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.orders.overview(query, options);
}
