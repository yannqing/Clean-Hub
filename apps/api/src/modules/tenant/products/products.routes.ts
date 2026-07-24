import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  getTenantProductOverviewController,
  listTenantProductsController,
} from "./products.controller.js";

export function createTenantProductRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/overview", getTenantProductOverviewController);
  routes.get("/", listTenantProductsController);

  return routes;
}
