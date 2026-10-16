"use server";

import type {
  PosOrderDetail,
  RemovePosOrderDiscountRequest,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { runOrderAction, type OrderActionResult } from "./order-action-helpers";
import { revalidateOrderPages } from "./order-action-revalidate";

export async function removeOrderDiscountAction(
  orderId: string,
  applicationId: string,
  input: RemovePosOrderDiscountRequest,
): Promise<OrderActionResult<PosOrderDetail>> {
  const result = await runOrderAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.orders.removeDiscount(
      orderId,
      applicationId,
      input,
      options,
    );
  });

  if (result.ok) {
    revalidateOrderPages(orderId);
  }

  return result;
}
