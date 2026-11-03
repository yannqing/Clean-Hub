import "server-only";

import { revalidatePath } from "next/cache";

export const ORDERS_LIST_PATH = "/orders";

export function orderDetailPath(orderId: string): string {
  return `/orders/${orderId}`;
}

export function revalidateOrderPages(orderId?: string): void {
  revalidatePath(ORDERS_LIST_PATH);
  if (orderId) {
    revalidatePath(orderDetailPath(orderId));
  }
}
