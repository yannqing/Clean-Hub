import "server-only";

import type { RelatedOrderListResponse } from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

/** Fetch the orders linked to a ticket (used by the detail page side panel). */
export async function getRelatedOrdersQuery(
  ticketId: string,
): Promise<RelatedOrderListResponse> {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.serviceTickets.getRelatedOrders(ticketId, options);
}
