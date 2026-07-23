"use server";

import type {
  CreatePosPaymentRequest,
  CreatePosPaymentResponse,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { runOrderAction, type OrderActionResult } from "./order-action-helpers";
import { revalidateOrderPages } from "./order-action-revalidate";

export async function payOrderAction(
  orderId: string,
  input: CreatePosPaymentRequest,
): Promise<OrderActionResult<CreatePosPaymentResponse>> {
  const result = await runOrderAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.orders.pay(orderId, input, options);
  });

  if (result.ok) {
    revalidateOrderPages(orderId);
  }

  return result;
}
