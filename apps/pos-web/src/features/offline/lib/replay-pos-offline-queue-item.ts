import { isApiHttpError } from "@cleanhub/api-client";
import type { OfflineQueueItem } from "@cleanhub/offline";

import { posApi } from "@/lib/api-client";

import {
  replayPosOfflineQueueItem,
  POS_OFFLINE_ENTITIES,
  type OrderCheckoutPayload,
  type OrderPaymentCreatePayload,
  type PosOfflineReplayApi,
} from "./pos-offline-operations";

const replayApi: PosOfflineReplayApi = {
  createCustomerAccount: (input, options) =>
    posApi.pos.accounts.create(input, options),
  createCustomerProfile: (accountId, input, options) =>
    posApi.pos.accounts.createProfile(accountId, input, options),
  createOrder: (input, options) => posApi.pos.orders.create(input, options),
  checkoutOrder: (input, options) => posApi.pos.orders.checkout(input, options),
  payOrder: (orderId, input, options) =>
    posApi.pos.orders.pay(orderId, input, options),
  changeOrderStatus: (orderId, input, options) =>
    posApi.pos.orders.changeStatus(orderId, input, options),
  changeTicketStatus: (ticketId, input, options) =>
    posApi.pos.serviceTickets.changeStatus(ticketId, input, options),
};

function getOfflineCashCommand(item: OfflineQueueItem) {
  if (item.entity === POS_OFFLINE_ENTITIES.orderCheckout) {
    const payload = item.payload as OrderCheckoutPayload;
    return payload.input.payment?.paymentMethod === "cash"
      ? {
          orderId: payload.input.order.id!,
          command: { type: "checkout" as const, input: payload.input },
        }
      : null;
  }
  if (item.entity === POS_OFFLINE_ENTITIES.orderPaymentCreate) {
    const payload = item.payload as OrderPaymentCreatePayload;
    return payload.input.paymentMethod === "cash"
      ? {
          orderId: payload.orderId,
          command: {
            type: "payment" as const,
            orderId: payload.orderId,
            input: payload.input,
          },
        }
      : null;
  }
  return null;
}

export async function replayCurrentPosOfflineQueueItem(
  item: OfflineQueueItem,
): Promise<void> {
  const cash = getOfflineCashCommand(item);
  if (!cash) return replayPosOfflineQueueItem(item, replayApi);

  const existing = await posApi.pos.offlineSales
    .get(item.idempotencyKey)
    .catch((error: unknown) => {
      if (isApiHttpError(error) && error.status === 404) return null;
      throw error;
    });
  if (existing?.status === "resolved") return;

  try {
    await replayPosOfflineQueueItem(item, replayApi);
  } catch (error) {
    await posApi.pos.offlineSales
      .report({
        commandId: item.idempotencyKey,
        orderId: cash.orderId,
        command: cash.command,
        failureCode: isApiHttpError(error) ? error.code : undefined,
        failureMessage:
          error instanceof Error ? error.message : "Offline replay failed.",
      })
      .catch(() => undefined);
    throw error;
  }

  if (existing?.status === "open") {
    await posApi.pos.offlineSales.acknowledgeRecovered(item.idempotencyKey);
  }
}
