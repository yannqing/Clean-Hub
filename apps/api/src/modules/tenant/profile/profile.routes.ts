import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  changeTenantSelfPasswordController,
  getTenantSelfProfileController,
  updateTenantSelfProfileController,
} from "./profile.controller.js";

export function createTenantProfileRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", getTenantSelfProfileController);
  routes.patch("/", updateTenantSelfProfileController);
  routes.patch("/password", changeTenantSelfPasswordController);

  return routes;
}

