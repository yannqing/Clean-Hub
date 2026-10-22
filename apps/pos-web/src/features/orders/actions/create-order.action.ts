"use server";

import type {
  CreatePosOrderRequest,
  PosOrderDetail,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { runOrderAction, type OrderActionResult } from "./order-action-helpers";
import { revalidateOrderPages } from "./order-action-revalidate";

export async function createOrderAction(
  input: CreatePosOrderRequest,
): Promise<OrderActionResult<PosOrderDetail>> {
  const result = await runOrderAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.orders.create(input, options);
  });

  if (result.ok) {
    revalidateOrderPages(result.data?.id);
  }

  return result;
}
