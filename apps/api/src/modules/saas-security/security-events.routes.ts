import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import { listSecurityEventsController } from "./security-events.controller.js";

export function createSaasSecurityEventRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listSecurityEventsController);

  return routes;
}
