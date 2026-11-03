import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  bindPosDeviceController,
  getPosDeviceController,
  getTerminalStateController,
  revokePosDeviceController,
  rotatePosDeviceCredentialController,
  setTerminalLockController,
  updatePosDeviceController,
} from "./auth.controller.js";

export type CreatePosAuthRoutesOptions = {
  terminalCredentialCookieSecure?: boolean;
};

export function createPosAuthRoutes({
  terminalCredentialCookieSecure,
}: CreatePosAuthRoutesOptions = {}) {
  const routes = new Hono<AppBindings>();

  routes.post("/devices", (c) =>
    bindPosDeviceController(c, terminalCredentialCookieSecure),
  );
  routes.get("/devices/:deviceId", getPosDeviceController);
  routes.patch("/devices/:deviceId", updatePosDeviceController);
  routes.post("/devices/:deviceId/credential-rotation", (c) =>
    rotatePosDeviceCredentialController(c, terminalCredentialCookieSecure),
  );
  routes.post("/devices/:deviceId/revocation", (c) =>
    revokePosDeviceController(c, terminalCredentialCookieSecure),
  );
  routes.get("/terminals/:deviceId", getTerminalStateController);
  routes.patch("/terminals/:deviceId/lock", setTerminalLockController);

  return routes;
}
