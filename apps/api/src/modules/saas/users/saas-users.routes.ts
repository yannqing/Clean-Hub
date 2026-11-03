import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createSaasUserController,
  getSaasUserController,
  getSaasUserDirectoryDetailController,
  resetDirectoryUserPasswordController,
  resetDirectoryUserPinController,
  listSaasUsersController,
  listSaasUserDirectoryController,
  getSaasUserStatsController,
  resetSaasUserPasswordController,
  updateSaasUserController,
  updateSaasUserRolesController,
  updateSaasUserStatusController,
} from "./saas-users.controller.js";

export function createSaasUsersRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listSaasUsersController);
  routes.get("/stats", getSaasUserStatsController);
  routes.get("/directory", listSaasUserDirectoryController);
  routes.get("/directory/:userId", getSaasUserDirectoryDetailController);
  routes.patch("/directory/:userId/reset-password", resetDirectoryUserPasswordController);
  routes.patch("/directory/:userId/reset-pin", resetDirectoryUserPinController);
  routes.post("/", createSaasUserController);
  routes.get("/:userId", getSaasUserController);
  routes.patch("/:userId/roles", updateSaasUserRolesController);
  routes.patch("/:userId/status", updateSaasUserStatusController);
  routes.patch("/:userId/reset-password", resetSaasUserPasswordController);
  routes.patch("/:userId", updateSaasUserController);

  return routes;
}
