import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  createTenantUserController,
  disableTenantUserController,
  enableTenantUserController,
  getTenantUserController,
  listTenantUsersController,
  resetTenantUserPinController,
  updateTenantUserController,
} from "./tenant-users.controller.js";

export function createTenantUsersRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantUsersController);
  routes.post("/", createTenantUserController);
  routes.get("/:userId", getTenantUserController);
  routes.patch("/:userId/disable", disableTenantUserController);
  routes.patch("/:userId/enable", enableTenantUserController);
  routes.patch("/:userId/reset-pin", resetTenantUserPinController);
  routes.patch("/:userId", updateTenantUserController);

  return routes;
}
