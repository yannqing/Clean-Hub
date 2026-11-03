import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { searchPosGlobalController } from "./search.controller.js";

export function createPosSearchRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", searchPosGlobalController);

  return routes;
}
