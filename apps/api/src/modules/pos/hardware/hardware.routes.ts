import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  authorizeManualDrawerOpenController,
  authorizePrivilegedReprintController,
  bindPosPrinterController,
  listHardwareDevicesController,
  recordCashPaymentDrawerResultController,
  recordPosPrintJobResultController,
} from "./hardware.controller.js";

/**
 * POS hardware device and action authorization routes.
 *
 * Mounted at `/pos/hardware-devices` (see `pos.routes.ts`).
 * POS terminals can list devices and authorize privileged actions. Owners and
 * managers may bind a configured logical printer to a local OS printer;
 * creation, relocation and deletion remain admin-only.
 */
export function createPosHardwareRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listHardwareDevicesController);
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
