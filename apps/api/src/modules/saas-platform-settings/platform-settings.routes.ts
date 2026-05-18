import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  getPlatformSettingsController,
  updatePlatformSettingsController,
} from "./platform-settings.controller.js";

export function createSaasPlatformSettingsRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", getPlatformSettingsController);
  routes.patch("/", updatePlatformSettingsController);

  return routes;
}
