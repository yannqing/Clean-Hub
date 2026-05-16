import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  createSaasUserController,
  getSaasUserController,
  listSaasUsersController,
} from "./saas-users.controller.js";

export function createSaasUsersRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listSaasUsersController);
  routes.post("/", createSaasUserController);
  routes.get("/:userId", getSaasUserController);

  return routes;
}
