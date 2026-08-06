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

export type ShiftHandoverSummaryOptions = {
  /**
   * Clock-in time of the active shift. When present the cash/order figures are
   * computed over the shift window instead of the calendar day, matching the
   * server-side Z Report snapshot produced by `POST /pos/staff/handovers`.
   * Without this alignment the page shows "today" totals while the Z Report
   * stores shift totals, and the cash difference is reported incorrectly.
   */
  shiftStartedAt?: string | null;
};

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

function summaryRange(shiftStartedAt: string | null | undefined): {
  createdAfter: string;
  createdBefore: string;
} {
  if (!shiftStartedAt) {
    return todayRange();
  }

  return {
    createdAfter: shiftStartedAt,
    createdBefore: new Date().toISOString(),
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

export async function getShiftHandoverSummaryQuery(
  options: ShiftHandoverSummaryOptions = {},
): Promise<ShiftHandoverSummary> {
  const now = new Date();
  const range = summaryRange(options.shiftStartedAt);

  const [
    orders,
    unpaidOrders,
    partialOrders,
    tickets,
    readyTickets,
    overdueTickets,
    exceptionTickets,
  ] = await Promise.all([
    // `createdAfter` takes precedence over `period` server-side, so this is
    // the shift window when a shift is active and "today" otherwise.
    getOrderOverviewQuery({ period: "today", ...range }).catch(() => null),
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
