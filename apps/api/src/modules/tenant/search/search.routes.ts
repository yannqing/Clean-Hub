import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { searchTenantGlobalController } from "./search.controller.js";

export function createTenantSearchRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", searchTenantGlobalController);

  return routes;
}
