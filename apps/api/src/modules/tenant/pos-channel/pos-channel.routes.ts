import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  getTenantPosChannelOverviewController,
  getTenantPosChannelSettingsController,
  listTenantPosChannelDevicesController,
  listTenantPosChannelRegisterSessionsController,
  removeTenantPosChannelDeviceController,
  updateTenantPosChannelDeviceController,
  updateTenantPosChannelSettingsController,
} from "./pos-channel.controller.js";

export function createTenantPosChannelRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/overview", getTenantPosChannelOverviewController);
  routes.get("/devices", listTenantPosChannelDevicesController);
  routes.patch("/devices/:terminalId", updateTenantPosChannelDeviceController);
  routes.delete("/devices/:terminalId", removeTenantPosChannelDeviceController);
  routes.get(
    "/register-sessions",
    listTenantPosChannelRegisterSessionsController,
  );
  routes.get("/settings", getTenantPosChannelSettingsController);
  routes.patch("/settings", updateTenantPosChannelSettingsController);

  return routes;
}
