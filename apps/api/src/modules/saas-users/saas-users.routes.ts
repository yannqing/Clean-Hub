import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  createSaasUserController,
  getSaasUserController,
  listSaasUsersController,
  updateSaasUserController,
  updateSaasUserStatusController,
} from "./saas-users.controller.js";

export function createSaasUsersRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listSaasUsersController);
  routes.post("/", createSaasUserController);
  routes.get("/:userId", getSaasUserController);
  routes.patch("/:userId/status", updateSaasUserStatusController);
  routes.patch("/:userId", updateSaasUserController);

  return routes;
}
