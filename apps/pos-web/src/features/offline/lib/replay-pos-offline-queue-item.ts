import type { OfflineQueueItem } from "@cleanhub/offline";

import { posApi } from "@/lib/api-client";

import {
  replayPosOfflineQueueItem,
  type PosOfflineReplayApi,
} from "./pos-offline-operations";

const replayApi: PosOfflineReplayApi = {
  createCustomerAccount: (input, options) =>
    posApi.pos.accounts.create(input, options),
  createCustomerProfile: (accountId, input, options) =>
    posApi.pos.accounts.createProfile(accountId, input, options),
  createOrder: (input, options) => posApi.pos.orders.create(input, options),
  changeOrderStatus: (orderId, input, options) =>
    posApi.pos.orders.changeStatus(orderId, input, options),
  changeTicketStatus: (ticketId, input, options) =>
    posApi.pos.serviceTickets.changeStatus(ticketId, input, options),
};

export function replayCurrentPosOfflineQueueItem(
  item: OfflineQueueItem,
): Promise<void> {
  return replayPosOfflineQueueItem(item, replayApi);
}
