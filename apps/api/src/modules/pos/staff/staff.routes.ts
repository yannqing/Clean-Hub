import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  clockActionController,
  createShiftCashMovementController,
  createHandoverController,
  getCurrentShiftController,
  getCurrentShiftReconciliationController,
  listCurrentShiftCashMovementsController,
  getPosStaffController,
  getPosZReportController,
  listPosStaffController,
  listPosZReportsController,
} from "./staff.controller.js";

export function createPosStaffRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listPosStaffController);
  routes.get("/current-shift", getCurrentShiftController);
  routes.get(
    "/current-shift/reconciliation",
    getCurrentShiftReconciliationController,
  );
  routes.get(
    "/current-shift/cash-movements",
    listCurrentShiftCashMovementsController,
  );
  routes.post(
    "/current-shift/cash-movements",
    createShiftCashMovementController,
  );
  routes.post("/clock", clockActionController);
  routes.post("/handovers", createHandoverController);
  routes.get("/z-reports", listPosZReportsController);
  routes.get("/z-reports/:zReportId", getPosZReportController);
  routes.get("/:staffId", getPosStaffController);

  return routes;
}
