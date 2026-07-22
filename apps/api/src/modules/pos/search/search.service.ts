import { getDb, type Database } from "@cleanhub/db";

import {
  requirePosTenantId,
  resolvePosBranchScope,
} from "../access-control.helper.js";
import { searchPosGlobal } from "./search.repository.js";
import type {
  PosGlobalSearchInput,
  PosGlobalSearchResponse,
} from "./search.types.js";

export async function searchPosGlobalService(
  input: PosGlobalSearchInput,
  db: Database = getDb(),
): Promise<PosGlobalSearchResponse> {
  const tenantId = requirePosTenantId(input.authContext);
  const allowedBranchIds = resolvePosBranchScope(input.authContext);

  if (allowedBranchIds?.length === 0) {
    return {
      query: input.query.q,
      total: 0,
      groups: { customers: [], tickets: [], orders: [] },
    };
  }

  return searchPosGlobal(db, {
    tenantId,
    allowedBranchIds,
    q: input.query.q,
    limit: input.query.limit,
  });
}
