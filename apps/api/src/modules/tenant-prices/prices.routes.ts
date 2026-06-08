import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  listTenantPricesController,
  updateTenantPriceController,
} from "./prices.controller.js";

export function createTenantPriceRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantPricesController);
  routes.patch("/:priceId", updateTenantPriceController);

  return routes;
}
