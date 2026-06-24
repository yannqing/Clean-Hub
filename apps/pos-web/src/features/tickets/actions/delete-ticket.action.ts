"use server";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { revalidateTicketPages } from "./ticket-action-revalidate";
import {
  runTicketAction,
  type TicketActionResult,
} from "./ticket-action-helpers";

/** Soft-delete a whole ticket (cascades to its items server-side). */
export async function deleteTicketAction(
  ticketId: string,
): Promise<TicketActionResult<void>> {
  const result = await runTicketAction(async () => {
    const options = await getPosServerApiRequestOptions();
    await posApi.pos.serviceTickets.remove(ticketId, options);
  });

  if (result.ok) {
    revalidateTicketPages(ticketId);
  }
  return result;
}
