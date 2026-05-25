import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  createTenantServiceController,
  deleteTenantServiceController,
  listTenantServicesController,
  updateTenantServiceController,
} from "./services.controller.js";

export function createTenantServiceRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantServicesController);
  routes.post("/", createTenantServiceController);
  routes.patch("/:serviceId", updateTenantServiceController);
  routes.delete("/:serviceId", deleteTenantServiceController);

  return routes;
}
