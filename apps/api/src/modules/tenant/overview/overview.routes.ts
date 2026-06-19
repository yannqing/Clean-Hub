import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getTenantOverviewController } from "./overview.controller.js";

export function createTenantOverviewRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", getTenantOverviewController);

  return routes;
}
