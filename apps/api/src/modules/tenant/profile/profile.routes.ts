import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  changeTenantSelfPasswordController,
  getTenantLoginSessionsController,
  getTenantSelfProfileController,
  revokeTenantLoginSessionController,
  updateTenantSelfProfileController,
} from "./profile.controller.js";

export function createTenantProfileRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", getTenantSelfProfileController);
  routes.get("/sessions", getTenantLoginSessionsController);
  routes.patch("/", updateTenantSelfProfileController);
  routes.patch("/password", changeTenantSelfPasswordController);
  routes.delete("/sessions/:sessionId", revokeTenantLoginSessionController);

  return routes;
}
