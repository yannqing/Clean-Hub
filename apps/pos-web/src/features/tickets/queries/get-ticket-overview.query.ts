import "server-only";

import type { ServiceTicketOverview } from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

/** Fetch ticket overview counters for the dashboard metrics row. */
export async function getTicketOverviewQuery(query?: {
  branchId?: string;
}): Promise<ServiceTicketOverview | null> {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.serviceTickets.getOverview(query, options);
}
