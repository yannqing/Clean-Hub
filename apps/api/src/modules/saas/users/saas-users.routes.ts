import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createSaasUserController,
  getSaasUserController,
  listSaasUsersController,
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
  routes.post("/", createSaasUserController);
  routes.get("/:userId", getSaasUserController);
  routes.patch("/:userId/roles", updateSaasUserRolesController);
  routes.patch("/:userId/status", updateSaasUserStatusController);
  routes.patch("/:userId/reset-password", resetSaasUserPasswordController);
  routes.patch("/:userId", updateSaasUserController);

  return routes;
}
