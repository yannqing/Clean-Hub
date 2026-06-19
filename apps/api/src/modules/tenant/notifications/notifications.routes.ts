import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  getTenantNotificationSettingsController,
  updateTenantNotificationSettingsController,
} from "./notifications.controller.js";

export function createTenantNotificationRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", getTenantNotificationSettingsController);
  routes.patch("/", updateTenantNotificationSettingsController);

  return routes;
}
