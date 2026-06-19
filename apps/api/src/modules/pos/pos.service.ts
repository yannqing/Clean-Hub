import { getDb, type Database } from "@cleanhub/db";

import { assertPosContext } from "../auth/permission.helper.js";
import { findBranchById } from "../tenant/branches/branches.repository.js";
import type { PosBranchMeInput, PosBranchSummary } from "./pos.types.js";

/**
 * Resolve the current POS user's branch.
 *
 * A POS terminal is single-store, so the cashier's first assigned branch is
 * treated as the active branch. Returns null when the user has no branch
 * assignment yet (frontend degrades gracefully).
 */
export async function getMyPosBranch(
  input: PosBranchMeInput,
  db: Database = getDb(),
): Promise<PosBranchSummary | null> {
  assertPosContext(input.authContext);

  const branchId = input.authContext.branchIds[0];

  if (!branchId) {
    return null;
  }

  return findBranchById(db, {
    tenantId: input.authContext.tenantId!,
    branchId,
  });
}
