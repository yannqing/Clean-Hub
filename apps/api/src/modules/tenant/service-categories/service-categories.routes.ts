import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { listTenantServiceCategoriesController } from "./service-categories.controller.js";

export function createTenantServiceCategoryRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantServiceCategoriesController);

  return routes;
}
