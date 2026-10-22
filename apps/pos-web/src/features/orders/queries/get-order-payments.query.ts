import "server-only";

import type { PosOrderPaymentsResponse } from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

export async function getOrderPaymentsQuery(
  orderId: string,
): Promise<PosOrderPaymentsResponse> {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.orders.listPayments(orderId, options);
}
