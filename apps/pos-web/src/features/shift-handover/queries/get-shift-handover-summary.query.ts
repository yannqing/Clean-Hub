import "server-only";

import type {
  PosOrderListResponse,
  ServiceTicketListResponse,
} from "@cleanhub/api-client";

import {
  getOrderOverviewQuery,
  getOrdersListQuery,
} from "@/features/orders/queries";
import {
  getTicketOverviewQuery,
  getTicketsListQuery,
} from "@/features/tickets/queries";

import type { ShiftHandoverSummary } from "../types";

const LIST_LIMIT = 5;

function todayRange(): { createdAfter: string; createdBefore: string } {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  return {
    createdAfter: start.toISOString(),
    createdBefore: new Date(
      start.getTime() + 24 * 60 * 60 * 1000,
    ).toISOString(),
  };
}

function emptyOrderList(): PosOrderListResponse {
  return {
    data: [],
    total: 0,
  };
}

function emptyTicketList(): ServiceTicketListResponse {
  return {
    data: [],
    total: 0,
  };
}

export async function getShiftHandoverSummaryQuery(): Promise<ShiftHandoverSummary> {
  const now = new Date();
  const range = todayRange();

  const [
    orders,
    unpaidOrders,
    partialOrders,
    tickets,
    readyTickets,
    overdueTickets,
    exceptionTickets,
  ] = await Promise.all([
    getOrderOverviewQuery({ period: "today" }).catch(() => null),
    getOrdersListQuery({
      paymentStatus: "unpaid",
      ...range,
      limit: LIST_LIMIT,
      offset: 0,
    }).catch(emptyOrderList),
    getOrdersListQuery({
      paymentStatus: "partial",
      ...range,
      limit: LIST_LIMIT,
      offset: 0,
    }).catch(emptyOrderList),
    getTicketOverviewQuery({}).catch(() => null),
    getTicketsListQuery({
      status: "ready_to_pick",
      limit: LIST_LIMIT,
      offset: 0,
    }).catch(emptyTicketList),
    getTicketsListQuery({
      status: ["pending", "in_progress", "ready_to_pick"],
      expectedPickupBefore: now.toISOString(),
      limit: LIST_LIMIT,
      offset: 0,
    }).catch(emptyTicketList),
    getTicketsListQuery({
      status: "exception",
      limit: LIST_LIMIT,
      offset: 0,
    }).catch(emptyTicketList),
  ]);

  return {
    generatedAt: now.toISOString(),
    orders,
    tickets,
    pendingOrders: [...unpaidOrders.data, ...partialOrders.data].slice(
      0,
      LIST_LIMIT,
    ),
    readyTickets: readyTickets.data,
    overdueTickets: overdueTickets.data,
    exceptionTickets: exceptionTickets.data,
  };
}
