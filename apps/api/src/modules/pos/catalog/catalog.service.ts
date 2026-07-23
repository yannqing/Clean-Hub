import { getDb, type Database } from "@cleanhub/db";

import {
  requireAnyPosBranchAccess,
  requirePosBranchAccess,
  requirePosTenantId,
} from "../access-control.helper.js";
import { findPosCatalogServices } from "./catalog.repository.js";
import type {
  PosCatalogListInput,
  PosCatalogService,
} from "./catalog.types.js";

export async function listPosCatalogServices(
  input: PosCatalogListInput,
  db: Database = getDb(),
): Promise<PosCatalogService[]> {
  const tenantId = requirePosTenantId(input.authContext);
  if (input.query.branchId) {
    requirePosBranchAccess(input.authContext, input.query.branchId);
  } else {
    requireAnyPosBranchAccess(input.authContext);
  }
  return findPosCatalogServices(db, { tenantId, ...input.query });
}
