import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  authorizeManualDrawerOpenController,
  authorizePrivilegedReprintController,
  listHardwareDevicesController,
  recordPosPrintJobResultController,
} from "./hardware.controller.js";

/**
 * POS hardware device and action authorization routes.
 *
 * Mounted at `/pos/hardware-devices` (see `pos.routes.ts`).
 * POS terminals can list devices and authorize privileged actions but cannot
 * create, update, or delete device configuration.
 */
export function createPosHardwareRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listHardwareDevicesController);
  routes.post(
    "/actions/manual-drawer-open",
    authorizeManualDrawerOpenController,
  );
  routes.post(
    "/actions/privileged-reprint",
    authorizePrivilegedReprintController,
  );
  routes.post("/print-jobs/results", recordPosPrintJobResultController);

  return routes;
}
