import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  createSaasUserController,
  deleteSaasUserController,
  listSaasUsersController,
  listTenantUsersController,
  updateSaasUserController,
} from "./users.controller.js";

export function createSaasUserRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listSaasUsersController);
  routes.post("/", createSaasUserController);
  routes.patch("/:userId", updateSaasUserController);
  routes.delete("/:userId", deleteSaasUserController);

  return routes;
}

export function createTenantUserRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantUsersController);

  return routes;
}
