import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  clockActionController,
  createHandoverController,
  getPosStaffController,
  listPosStaffController,
} from "./staff.controller.js";

/**
 * POS staff routes — listing, clock-in/out, and shift handover.
 * Scaffold: handlers exist, service layer returns 501 until implemented.
 */
export function createPosStaffRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listPosStaffController);
  routes.get("/:staffId", getPosStaffController);
  routes.post("/clock", clockActionController);
  routes.post("/handovers", createHandoverController);

  return routes;
}
