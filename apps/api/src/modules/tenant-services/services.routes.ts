import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  createTenantServiceController,
  deleteTenantServiceController,
  getTenantServiceController,
  listTenantServicesController,
  updateTenantServiceController,
  updateTenantServiceStatusController,
} from "./services.controller.js";

export function createTenantServiceRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantServicesController);
  routes.post("/", createTenantServiceController);
  routes.patch("/:serviceId/status", updateTenantServiceStatusController);
  routes.patch("/:serviceId", updateTenantServiceController);
  routes.delete("/:serviceId", deleteTenantServiceController);
  routes.get("/:serviceId", getTenantServiceController);

  return routes;
}
