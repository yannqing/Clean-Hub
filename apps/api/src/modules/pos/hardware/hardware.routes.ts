import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  authorizeManualDrawerOpenController,
  authorizePrivilegedReprintController,
  bindPosPrinterController,
  connectPosBuiltInHardwareController,
  listHardwareDevicesController,
  recordCashPaymentDrawerResultController,
  recordPosPrintJobResultController,
} from "./hardware.controller.js";

/**
 * POS hardware device and action authorization routes.
 *
 * Mounted at `/pos/hardware-devices` (see `pos.routes.ts`).
 * POS terminals can list devices and authorize privileged actions. Owners and
 * managers may register native built-in hardware or bind a configured logical
 * printer to a local OS printer. Manual creation and relocation remain
 * admin-only, and built-in records cannot be edited or deleted in web-admin.
 */
export function createPosHardwareRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listHardwareDevicesController);
  routes.post("/built-in-connections", connectPosBuiltInHardwareController);
  routes.put("/:hardwareId/printer-binding", bindPosPrinterController);
  routes.post(
    "/actions/manual-drawer-open",
    authorizeManualDrawerOpenController,
  );
  routes.post(
    "/actions/privileged-reprint",
    authorizePrivilegedReprintController,
  );
  routes.post("/print-jobs/results", recordPosPrintJobResultController);
  routes.post(
    "/cash-payments/drawer-results",
    recordCashPaymentDrawerResultController,
  );

  return routes;
}
