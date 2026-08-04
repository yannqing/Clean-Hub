import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  getTenantOrderOverview,
  listTenantOrders,
} from "./orders.service.js";
import {
  tenantOrderListQuerySchema,
  tenantOrderOverviewQuerySchema,
} from "./orders.validation.js";

export async function listTenantOrdersController(c: Context<AppBindings>) {
  const query = tenantOrderListQuerySchema.parse(c.req.query());
  const result = await listTenantOrders({
    authContext: c.get("authContext"),
    query,
  });

  return c.json(result);
}

export async function getTenantOrderOverviewController(
  c: Context<AppBindings>,
) {
  const query = tenantOrderOverviewQuerySchema.parse(c.req.query());
  const overview = await getTenantOrderOverview(
    c.get("authContext"),
    query,
  );

  return c.json(overview);
}
