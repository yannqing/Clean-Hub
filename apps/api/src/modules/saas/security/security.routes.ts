import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { createSaasSecurityEventRoutes } from "./security-events.routes.js";
import { createSaasSecuritySettingsRoutes } from "./security-settings.routes.js";

export function createSaasSecurityRoutes() {
  const routes = new Hono<AppBindings>();

  routes.route("/events", createSaasSecurityEventRoutes());
  routes.route("/settings", createSaasSecuritySettingsRoutes());

  return routes;
}
