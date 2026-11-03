import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { listSaasRolesController } from "./saas-users.controller.js";

export function createSaasRolesRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listSaasRolesController);

  return routes;
}
