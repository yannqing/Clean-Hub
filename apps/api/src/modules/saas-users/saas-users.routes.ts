import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import { listSaasUsersController } from "./saas-users.controller.js";

export function createSaasUsersRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listSaasUsersController);

  return routes;
}
