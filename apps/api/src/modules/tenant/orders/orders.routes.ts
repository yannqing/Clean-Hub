import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  getTenantOrderOverviewController,
  listTenantOrdersController,
} from "./orders.controller.js";

export function createTenantOrderRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantOrdersController);
  routes.get("/overview", getTenantOrderOverviewController);

  return routes;
}
