"use server";

import type {
  CreatePosOrderItemRequest,
  PosOrderDetail,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { runOrderAction, type OrderActionResult } from "./order-action-helpers";
import { revalidateOrderPages } from "./order-action-revalidate";

export async function createOrderItemAction(
  orderId: string,
  input: CreatePosOrderItemRequest,
): Promise<OrderActionResult<PosOrderDetail>> {
  const result = await runOrderAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.orders.createItem(orderId, input, options);
  });

  if (result.ok) {
    revalidateOrderPages(orderId);
  }

  return result;
}
