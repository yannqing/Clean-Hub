import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  listSaasUsersController,
  listTenantUsersController,
} from "./users.controller.js";

export function createSaasUserRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listSaasUsersController);

  return routes;
}

export function createTenantUserRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantUsersController);

  return routes;
}
