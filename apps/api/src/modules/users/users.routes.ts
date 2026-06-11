// DEPRECATED: These routes are superseded by modules/tenant-users (tenant staff CRUD)
// and modules/saas-users (SaaS platform user management). Neither createTenantUserRoutes
// nor createSaasUserRoutes is mounted in app.ts. Do not add new functionality here.
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
