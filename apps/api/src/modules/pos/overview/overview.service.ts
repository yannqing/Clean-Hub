/**
 * POS overview (statistics) — service layer (Scaffold).
 *
 * getPosOverview throws PosNotImplementedError until the aggregation queries
 * against orders/tickets are wired up.
 */
import type { PosOverview, PosOverviewInput } from "./overview.types.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";

export async function getPosOverview(
  _input: PosOverviewInput,
): Promise<PosOverview> {
  throw new PosNotImplementedError("getPosOverview");
}
