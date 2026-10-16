"use server";

import type {
  PosOrderDetail,
  ResolvePosPaymentRequest,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { runOrderAction, type OrderActionResult } from "./order-action-helpers";
import { revalidateOrderPages } from "./order-action-revalidate";

export async function failManualPaymentAction(
  orderId: string,
  paymentId: string,
  input: Required<ResolvePosPaymentRequest>,
): Promise<OrderActionResult<PosOrderDetail>> {
  const result = await runOrderAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.orders.failManualPayment(
      orderId,
      paymentId,
      input,
      options,
    );
  });

  if (result.ok) {
    revalidateOrderPages(orderId);
  }

  return result;
}
