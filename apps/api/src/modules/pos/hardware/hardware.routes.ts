import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { listHardwareDevicesController } from "./hardware.controller.js";

/**
 * POS hardware device routes (read-only).
 *
 * Mounted at `/pos/hardware-devices` (see `pos.routes.ts`).
 * POS terminals can list devices but cannot create/update/delete them.
 */
export function createPosHardwareRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listHardwareDevicesController);

  return routes;
}
