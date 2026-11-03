import "server-only";

import type { ServiceTicketDetail } from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

/** Fetch a single ticket by id (with items, without related orders). */
export async function getTicketDetailQuery(
  ticketId: string,
): Promise<ServiceTicketDetail | null> {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.serviceTickets.get(ticketId, options);
}
