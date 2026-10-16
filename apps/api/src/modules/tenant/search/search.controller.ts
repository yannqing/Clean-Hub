import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { searchTenantGlobalService } from "./search.service.js";
import { tenantGlobalSearchQuerySchema } from "./search.validation.js";

export async function searchTenantGlobalController(c: Context<AppBindings>) {
  const query = tenantGlobalSearchQuerySchema.parse(c.req.query());
  const result = await searchTenantGlobalService({
    authContext: c.get("authContext"),
    query,
  });

  return c.json(result);
}
