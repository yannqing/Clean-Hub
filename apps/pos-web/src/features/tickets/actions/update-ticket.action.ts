"use server";

import type {
  ServiceTicketDetail,
  UpdateServiceTicketRequest,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { revalidateTicketPages } from "./ticket-action-revalidate";
import {
  runTicketAction,
  type TicketActionResult,
} from "./ticket-action-helpers";

/**
 * Update a ticket's basic info (type/priority/source/assistant/pickup/remark).
 * Status changes go through `changeTicketStatusAction`, not here.
 */
export async function updateTicketAction(
  ticketId: string,
  input: UpdateServiceTicketRequest,
): Promise<TicketActionResult<ServiceTicketDetail>> {
  const result = await runTicketAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.serviceTickets.update(ticketId, input, options);
  });

  if (result.ok) {
    revalidateTicketPages(ticketId);
  }
  return result;
}
