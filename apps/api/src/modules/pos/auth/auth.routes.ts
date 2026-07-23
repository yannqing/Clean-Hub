import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  bindPosDeviceController,
  getPosDeviceController,
  getTerminalStateController,
  rotatePosDeviceCredentialController,
  setTerminalLockController,
  updatePosDeviceController,
} from "./auth.controller.js";

export function createPosAuthRoutes() {
  const routes = new Hono<AppBindings>();

  routes.post("/devices", bindPosDeviceController);
  routes.get("/devices/:deviceId", getPosDeviceController);
  routes.patch("/devices/:deviceId", updatePosDeviceController);
  routes.post(
    "/devices/:deviceId/credential-rotation",
    rotatePosDeviceCredentialController,
  );
  routes.get("/terminals/:deviceId", getTerminalStateController);
  routes.patch("/terminals/:deviceId/lock", setTerminalLockController);

  return routes;
}
