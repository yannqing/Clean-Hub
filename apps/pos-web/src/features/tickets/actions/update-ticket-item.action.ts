"use server";

import type {
  ServiceTicketItem,
  UpdateServiceTicketItemRequest,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { revalidateTicketPages } from "./ticket-action-revalidate";
import {
  runTicketAction,
  type TicketActionResult,
} from "./ticket-action-helpers";

/** Update a ticket item's fields (status changes use a separate action). */
export async function updateTicketItemAction(
  ticketId: string,
  itemId: string,
  input: UpdateServiceTicketItemRequest,
): Promise<TicketActionResult<ServiceTicketItem>> {
  const result = await runTicketAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.serviceTickets.updateItem(ticketId, itemId, input, options);
  });

  if (result.ok) {
    revalidateTicketPages(ticketId);
  }
  return result;
}
