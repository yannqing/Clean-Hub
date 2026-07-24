import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  getTenantProductOverview,
  listTenantProducts,
} from "./products.service.js";
import {
  tenantProductListQuerySchema,
  tenantProductOverviewQuerySchema,
} from "./products.validation.js";

export async function listTenantProductsController(c: Context<AppBindings>) {
  const query = tenantProductListQuerySchema.parse(c.req.query());
  const result = await listTenantProducts(c.get("authContext"), query);

  return c.json(result);
}

export async function getTenantProductOverviewController(
  c: Context<AppBindings>,
) {
  const query = tenantProductOverviewQuerySchema.parse(c.req.query());
  const result = await getTenantProductOverview(c.get("authContext"), query);

  return c.json(result);
}
