import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext } from "../../auth/auth.types.js";
import { assertPosContext } from "../../auth/permission.helper.js";
import { searchPosGlobal } from "./search.repository.js";
import type {
  PosGlobalSearchInput,
  PosGlobalSearchResponse,
} from "./search.types.js";

function requirePosContext(authContext: AuthContext): string {
  assertPosContext(authContext);
  return authContext.tenantId!;
}

function resolveListBranchScope(
  authContext: AuthContext,
): string[] | undefined {
  if (authContext.role === "owner" || authContext.role === "manager") {
    return authContext.branchIds.length > 0
      ? authContext.branchIds
      : undefined;
  }
  return authContext.branchIds;
}

export async function searchPosGlobalService(
  input: PosGlobalSearchInput,
  db: Database = getDb(),
): Promise<PosGlobalSearchResponse> {
  const tenantId = requirePosContext(input.authContext);

  return searchPosGlobal(db, {
    tenantId,
    allowedBranchIds: resolveListBranchScope(input.authContext),
    q: input.query.q,
    limit: input.query.limit,
  });
}
