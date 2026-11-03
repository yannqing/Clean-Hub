"use server";

import type {
  PosOrderDetail,
  UpdatePosOrderItemRequest,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { runOrderAction, type OrderActionResult } from "./order-action-helpers";
import { revalidateOrderPages } from "./order-action-revalidate";

export async function updateOrderItemAction(
  orderId: string,
  itemId: string,
  input: UpdatePosOrderItemRequest,
): Promise<OrderActionResult<PosOrderDetail>> {
  const result = await runOrderAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.orders.updateItem(orderId, itemId, input, options);
  });

  if (result.ok) {
    revalidateOrderPages(orderId);
  }

  return result;
}
