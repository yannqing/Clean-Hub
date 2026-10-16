import "server-only";

import type {
  ServiceTicketListQuery,
  ServiceTicketListResponse,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

/**
 * Fetch the ticket list for the POS user. Mirrors the
 * `getMyBranchQuery` pattern: resolve server API options (forwards auth
 * cookies), call the typed api-client method, return the typed DTO.
 *
 * Query is composed by the caller (the page), so this stays a thin pass-through.
 */
export async function getTicketsListQuery(
  query?: ServiceTicketListQuery,
): Promise<ServiceTicketListResponse> {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.serviceTickets.list(query, options);
}
