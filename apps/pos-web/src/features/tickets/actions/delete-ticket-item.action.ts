"use server";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { revalidateTicketPages } from "./ticket-action-revalidate";
import {
  runTicketAction,
  type TicketActionResult,
} from "./ticket-action-helpers";

/** Soft-delete a ticket item. */
export async function deleteTicketItemAction(
  ticketId: string,
  itemId: string,
  reason: string,
): Promise<TicketActionResult<void>> {
  const result = await runTicketAction(async () => {
    const options = await getPosServerApiRequestOptions();
    await posApi.pos.serviceTickets.removeItem(ticketId, itemId, reason, options);
  });

  if (result.ok) {
    revalidateTicketPages(ticketId);
  }
  return result;
}
