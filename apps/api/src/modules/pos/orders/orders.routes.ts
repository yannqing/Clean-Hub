import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createPosOrderController,
  getPosOrderController,
  listPosOrdersController,
} from "./orders.controller.js";

/**
 * POS order routes. Scaffold — handlers exist but the service layer throws
 * PosNotImplementedError until the repository is wired up.
 */
export function createPosOrdersRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listPosOrdersController);
  routes.post("/", createPosOrderController);
  routes.get("/:orderId", getPosOrderController);

  return routes;
}
