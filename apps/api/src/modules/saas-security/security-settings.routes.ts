import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  getSecuritySettingsController,
  updateSecuritySettingsController,
} from "./security-settings.controller.js";

export function createSaasSecuritySettingsRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", getSecuritySettingsController);
  routes.patch("/", updateSecuritySettingsController);

  return routes;
}
