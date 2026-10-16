import "server-only";

import type { PosOrderDetail } from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

export async function getOrderDetailQuery(
  orderId: string,
): Promise<PosOrderDetail> {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.orders.get(orderId, options);
}
