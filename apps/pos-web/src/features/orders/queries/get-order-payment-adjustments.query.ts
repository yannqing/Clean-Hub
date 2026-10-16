import "server-only";

import type { PosPaymentAdjustmentListResponse } from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

export async function getOrderPaymentAdjustmentsQuery(
  orderId: string,
): Promise<PosPaymentAdjustmentListResponse> {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.paymentAdjustments.list(orderId, options);
}
