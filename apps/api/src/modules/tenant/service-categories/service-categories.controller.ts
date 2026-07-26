import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { listTenantServiceCategories } from "./service-categories.service.js";
import { serviceCategoryListQuerySchema } from "./service-categories.validation.js";

export async function listTenantServiceCategoriesController(
  c: Context<AppBindings>,
) {
  const query = serviceCategoryListQuerySchema.parse(c.req.query());
  const categories = await listTenantServiceCategories(
    c.get("authContext"),
    query,
  );

  return c.json(categories);
}
