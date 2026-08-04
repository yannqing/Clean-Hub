import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createTenantUserController,
  getTenantUserController,
  listTenantUsersController,
  resetTenantUserPasswordController,
  resetTenantUserPinController,
  updateTenantUserController,
  updateTenantUserStatusController,
} from "./tenant-users.controller.js";

export function createTenantUsersRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantUsersController);
  routes.post("/", createTenantUserController);
  routes.patch("/:userId/status", updateTenantUserStatusController);
  routes.patch("/:userId/pin", resetTenantUserPinController);
  routes.patch("/:userId/password", resetTenantUserPasswordController);
  routes.get("/:userId", getTenantUserController);
  routes.patch("/:userId", updateTenantUserController);

  return routes;
}
