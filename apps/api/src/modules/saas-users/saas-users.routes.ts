import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  createSaasUserController,
  listSaasUsersController,
} from "./saas-users.controller.js";

export function createSaasUsersRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listSaasUsersController);
  routes.post("/", createSaasUserController);

  return routes;
}
