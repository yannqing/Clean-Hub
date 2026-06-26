"use server";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { runOrderAction, type OrderActionResult } from "./order-action-helpers";
import { revalidateOrderPages } from "./order-action-revalidate";

export async function deleteOrderAction(
  orderId: string,
): Promise<OrderActionResult<void>> {
  const result = await runOrderAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.orders.remove(orderId, options);
  });

  if (result.ok) {
    revalidateOrderPages(orderId);
  }

  return result;
}
