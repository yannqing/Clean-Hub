"use server";

import type {
  ChangeServiceTicketStatusRequest,
  ServiceTicketDetail,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { revalidateTicketPages } from "./ticket-action-revalidate";
import {
  runTicketAction,
  type TicketActionResult,
} from "./ticket-action-helpers";

/**
 * Transition a ticket's status. Carries `version` for optimistic concurrency;
 * the backend rejects stale writes with `VERSION_CONFLICT`.
 */
export async function changeTicketStatusAction(
  ticketId: string,
  input: ChangeServiceTicketStatusRequest,
): Promise<TicketActionResult<ServiceTicketDetail>> {
  const result = await runTicketAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.serviceTickets.changeStatus(ticketId, input, options);
  });

  if (result.ok) {
    revalidateTicketPages(ticketId);
  }
  return result;
}
