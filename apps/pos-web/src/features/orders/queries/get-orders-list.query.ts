import "server-only";

import type {
  PosOrderListQuery,
  PosOrderListResponse,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

export async function getOrdersListQuery(
  query?: PosOrderListQuery,
): Promise<PosOrderListResponse> {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.orders.list(query, options);
}
