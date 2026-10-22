import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createHardwareConfigController,
  deleteHardwareConfigController,
  listHardwareConfigsController,
  updateHardwareConfigController,
} from "./hardware.controller.js";

export function createTenantHardwareRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listHardwareConfigsController);
  routes.post("/", createHardwareConfigController);
  routes.patch("/:hardwareId", updateHardwareConfigController);
  routes.delete("/:hardwareId", deleteHardwareConfigController);

  return routes;
}
