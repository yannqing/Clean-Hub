import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  getTerminalSettingsController,
  heartbeatTerminalController,
  updateTerminalSettingsController,
} from "./terminal-settings.controller.js";

/**
 * POS terminal settings routes.
 *
 * Mounted at `/pos/terminal-settings` (see `pos.routes.ts`).
 */
export function createPosTerminalSettingsRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", getTerminalSettingsController);
  routes.patch("/", updateTerminalSettingsController);
  routes.post("/heartbeat", heartbeatTerminalController);

  return routes;
}
