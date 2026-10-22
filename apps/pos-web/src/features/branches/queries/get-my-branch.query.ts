import "server-only";

import type { PosBranchSummary } from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

/**
 * Fetch the active branch for the signed-in POS user.
 *
 * Every POS server-side query follows this exact pattern:
 *   1. resolve server API options (forwards auth cookies)
 *   2. call the typed api-client method
 *   3. return the typed DTO
 *
 * New feature queries (customers, tickets, orders...) should mirror this file.
 */
export async function getMyBranchQuery(): Promise<PosBranchSummary | null> {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.branches.getMine(options);
}
