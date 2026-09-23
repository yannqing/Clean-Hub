import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  getPlatformSettingsController,
  updatePlatformSettingsController,
} from "./platform-settings.controller.js";
import {
  listPlatformTaxTemplatesController,
  upsertPlatformTaxTemplateController,
} from "./platform-tax-templates.controller.js";

export function createSaasPlatformSettingsRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", getPlatformSettingsController);
  routes.patch("/", updatePlatformSettingsController);
  routes.get("/tax-templates", listPlatformTaxTemplatesController);
  routes.put("/tax-templates", upsertPlatformTaxTemplateController);

  return routes;
}
