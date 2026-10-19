import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  requestTenantPosLogoUploadController,
  getTenantSettingsController,
  updateTenantSettingsController,
} from "./settings.controller.js";

export function createTenantSettingsRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", getTenantSettingsController);
  routes.patch("/", updateTenantSettingsController);
  routes.post("/pos-logo/upload-ticket", requestTenantPosLogoUploadController);

  return routes;
}
