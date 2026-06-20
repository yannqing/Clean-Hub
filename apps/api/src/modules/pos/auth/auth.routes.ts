import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  bindPosDeviceController,
  getPosDeviceController,
  getTerminalStateController,
  posPinLoginController,
  setTerminalLockController,
} from "./auth.controller.js";

/**
 * POS terminal authentication routes. POS-specific flows (PIN quick-login,
 * device binding, terminal lock) layered on top of the platform-wide login in
 * modules/auth/. Scaffold: handlers exist, service returns 501.
 */
export function createPosAuthRoutes() {
  const routes = new Hono<AppBindings>();

  routes.post("/pin-login", posPinLoginController);
  routes.post("/devices", bindPosDeviceController);
  routes.get("/devices/:deviceId", getPosDeviceController);
  routes.get("/terminals/:deviceId", getTerminalStateController);
  routes.patch("/terminals/:deviceId/lock", setTerminalLockController);

  return routes;
}
