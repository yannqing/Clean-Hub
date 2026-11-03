import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getPosOverviewController } from "./overview.controller.js";

/**
 * POS overview (statistics) routes. Scaffold — the handler exists but the
 * service layer throws PosNotImplementedError until the aggregation queries
 * are wired up.
 */
export function createPosOverviewRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", getPosOverviewController);

  return routes;
}
