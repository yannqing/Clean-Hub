import { getDb, type Database } from "@cleanhub/db";

import {
  requireAnyPosBranchAccess,
  requirePosBranchAccess,
  requirePosTenantId,
} from "../access-control.helper.js";
import {
  findPosCatalogProducts,
  findPosCatalogServices,
} from "./catalog.repository.js";
import type {
  PosCatalogListInput,
  PosCatalogProduct,
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

export async function listPosCatalogProducts(
  input: PosCatalogListInput,
  db: Database = getDb(),
): Promise<PosCatalogProduct[]> {
  const tenantId = requirePosTenantId(input.authContext);
  if (!input.query.branchId) {
    return [];
  }
  requirePosBranchAccess(input.authContext, input.query.branchId);
  return findPosCatalogProducts(db, {
    tenantId,
    ...input.query,
    branchId: input.query.branchId,
  });
}
