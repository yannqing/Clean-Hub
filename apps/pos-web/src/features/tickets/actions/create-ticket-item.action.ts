"use server";

import type {
  CreateServiceTicketItemRequest,
  ServiceTicketItem,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { revalidateTicketPages } from "./ticket-action-revalidate";
import {
  runTicketAction,
  type TicketActionResult,
} from "./ticket-action-helpers";

/**
 * Add a ticket item. The backend auto-generates the `labelCode` on insert,
 * so the client never sends one. Returns the created item.
 */
export async function createTicketItemAction(
  ticketId: string,
  input: CreateServiceTicketItemRequest,
): Promise<TicketActionResult<ServiceTicketItem>> {
  const result = await runTicketAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.serviceTickets.createItem(ticketId, input, options);
  });

  if (result.ok) {
    revalidateTicketPages(ticketId);
  }
  return result;
}
