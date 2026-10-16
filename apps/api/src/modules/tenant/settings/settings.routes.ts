import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  getTenantSettingsController,
  updateTenantSettingsController,
} from "./settings.controller.js";

export function createTenantSettingsRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", getTenantSettingsController);
  routes.patch("/", updateTenantSettingsController);

  return routes;
}
