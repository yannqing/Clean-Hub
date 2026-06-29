import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createTerminalSettingsController,
  getTerminalSettingsController,
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
  routes.post("/", createTerminalSettingsController);
  routes.patch("/", updateTerminalSettingsController);

  return routes;
}
