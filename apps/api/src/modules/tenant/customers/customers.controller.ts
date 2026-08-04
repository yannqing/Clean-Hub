import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { listTenantCustomers } from "./customers.service.js";
import { tenantCustomerListQuerySchema } from "./customers.validation.js";

export async function listTenantCustomersController(c: Context<AppBindings>) {
  const query = tenantCustomerListQuerySchema.parse(c.req.query());
  const result = await listTenantCustomers({
    authContext: c.get("authContext"),
    query,
  });

  return c.json(result);
}
