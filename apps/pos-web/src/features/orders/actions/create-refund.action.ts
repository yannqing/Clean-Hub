"use server";

import type {
  CreatePosPaymentAdjustmentResponse,
  CreatePosRefundRequest,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { runOrderAction, type OrderActionResult } from "./order-action-helpers";
import { revalidateOrderPages } from "./order-action-revalidate";

export async function createRefundAction(
  input: CreatePosRefundRequest,
): Promise<OrderActionResult<CreatePosPaymentAdjustmentResponse>> {
  const result = await runOrderAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.paymentAdjustments.createRefund(input, options);
  });

  if (result.ok) {
    revalidateOrderPages(input.orderId);
  }

  return result;
}
