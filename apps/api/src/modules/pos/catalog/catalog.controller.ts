import type { Context } from "hono";
import { getDb } from "@cleanhub/db";
import { selectedServiceItemGroups } from "@cleanhub/domain/service-item-catalog";
import { findTenantItemCatalog } from "../../service-item-catalog/service-item-catalog.repository.js";
import { requirePosTenantId, requireAnyPosBranchAccess } from "../access-control.helper.js";

import type { AppBindings } from "../../../http/types.js";
import {
  listPosCatalogProducts,
  listPosCatalogServices,
} from "./catalog.service.js";
import { posCatalogQuerySchema } from "./catalog.validation.js";

export async function listPosCatalogController(c: Context<AppBindings>) {
  const query = posCatalogQuerySchema.parse(c.req.query());
  const input = { authContext: c.get("authContext"), query };
  const tenantId = requirePosTenantId(input.authContext);
  requireAnyPosBranchAccess(input.authContext);
  const [data, products, itemCatalog] = await Promise.all([
    listPosCatalogServices(input),
    listPosCatalogProducts(input),
    findTenantItemCatalog(getDb(), tenantId),
  ]);
  return c.json({ data, products, itemCatalog: { ...itemCatalog, groups: selectedServiceItemGroups(itemCatalog) } });
}
