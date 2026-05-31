import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  createTenantUserController,
  disableTenantUserController,
  getTenantUserController,
  listSaasUsersController,
  listTenantUsersController,
  resetTenantUserPinController,
  updateTenantUserController,
} from "./users.controller.js";

export function createSaasUserRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listSaasUsersController);

  return routes;
}

export function createTenantUserRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantUsersController);
  routes.post("/", createTenantUserController);
  routes.get("/:userId", getTenantUserController);
  routes.patch("/:userId", updateTenantUserController);
  routes.patch("/:userId/disable", disableTenantUserController);
  routes.patch("/:userId/reset-pin", resetTenantUserPinController);

  return routes;
}
