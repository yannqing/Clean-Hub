import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createTenantServiceController,
  deleteTenantServiceController,
  getTenantServiceController,
  listTenantServicesController,
  requestTenantServiceMediaDownloadsController,
  requestTenantServiceMediaUploadController,
  updateTenantServiceController,
  updateTenantServiceStatusController,
} from "./services.controller.js";

export function createTenantServiceRoutes() {
  const routes = new Hono<AppBindings>();

  routes.post("/media/uploads", requestTenantServiceMediaUploadController);
  routes.post(
    "/media/downloads",
    requestTenantServiceMediaDownloadsController,
  );
  routes.get("/", listTenantServicesController);
  routes.post("/", createTenantServiceController);
  routes.patch("/:serviceId/status", updateTenantServiceStatusController);
  routes.patch("/:serviceId", updateTenantServiceController);
  routes.delete("/:serviceId", deleteTenantServiceController);
  routes.get("/:serviceId", getTenantServiceController);

  return routes;
}
