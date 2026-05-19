import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import { getSaasOverviewController } from "./overview.controller.js";

export function createSaasOverviewRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", getSaasOverviewController);

  return routes;
}
