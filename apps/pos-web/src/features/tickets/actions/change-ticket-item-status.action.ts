"use server";

import type {
  ChangeServiceTicketItemStatusRequest,
  ServiceTicketItem,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

import { revalidateTicketPages } from "./ticket-action-revalidate";
import {
  runTicketAction,
  type TicketActionResult,
} from "./ticket-action-helpers";

/** Transition a ticket item's status (washing → done → ready_to_pick). */
export async function changeTicketItemStatusAction(
  ticketId: string,
  itemId: string,
  input: ChangeServiceTicketItemStatusRequest,
): Promise<TicketActionResult<ServiceTicketItem>> {
  const result = await runTicketAction(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.serviceTickets.changeItemStatus(
      ticketId,
      itemId,
      input,
      options,
    );
  });

  if (result.ok) {
    revalidateTicketPages(ticketId);
  }
  return result;
}
