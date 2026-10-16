"use server";

import type {
  CreatePosPaymentAdjustmentResponse,
  CreatePosPaymentCorrectionRequest,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { runOrderAction, type OrderActionResult } from "./order-action-helpers";
import { revalidateOrderPages } from "./order-action-revalidate";

export async function createPaymentCorrectionAction(
  input: CreatePosPaymentCorrectionRequest,
): Promise<OrderActionResult<CreatePosPaymentAdjustmentResponse>> {
  const result = await runOrderAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.paymentAdjustments.createCorrection(input, options);
  });

  if (result.ok) {
    revalidateOrderPages(input.orderId);
  }

  return result;
}
