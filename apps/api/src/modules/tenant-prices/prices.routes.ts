import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  createTenantPriceBookController,
  deleteTenantPriceBookController,
  listTenantPriceBooksController,
  updateTenantPriceBookController,
} from "./prices.controller.js";

export function createTenantPriceRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantPriceBooksController);
  routes.post("/", createTenantPriceBookController);
  routes.patch("/:priceBookId", updateTenantPriceBookController);
  routes.delete("/:priceBookId", deleteTenantPriceBookController);

  return routes;
}
