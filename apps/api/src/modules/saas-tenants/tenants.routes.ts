import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  createSaasTenantController,
  getSaasTenantFeatureFlagsController,
  getSaasTenantController,
  getSaasTenantSettingsController,
  listSaasTenantsController,
  updateSaasTenantController,
  updateSaasTenantFeatureFlagsController,
  updateSaasTenantSettingsController,
  updateSaasTenantStatusController,
} from "./tenants.controller.js";

export function createSaasTenantsRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listSaasTenantsController);
  routes.post("/", createSaasTenantController);
  routes.get("/:tenantId/feature-flags", getSaasTenantFeatureFlagsController);
  routes.patch(
    "/:tenantId/feature-flags",
    updateSaasTenantFeatureFlagsController,
  );
  routes.get("/:tenantId/settings", getSaasTenantSettingsController);
  routes.patch("/:tenantId/settings", updateSaasTenantSettingsController);
  routes.patch("/:tenantId/status", updateSaasTenantStatusController);
  routes.get("/:tenantId", getSaasTenantController);
  routes.patch("/:tenantId", updateSaasTenantController);

  return routes;
}
