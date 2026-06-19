import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import { getMyPosBranchController } from "./pos.controller.js";

export function createPosRoutes() {
  const routes = new Hono<AppBindings>();

  // GET /pos/branches/me — the active branch for the signed-in POS user.
  routes.get("/branches/me", getMyPosBranchController);

  return routes;
}
