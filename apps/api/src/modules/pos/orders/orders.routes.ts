import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  changePosOrderStatusController,
  createPosOrderController,
  createPosOrderItemController,
  createPosOrderPaymentController,
  deletePosOrderController,
  deletePosOrderItemController,
  getPosOrderController,
  getPosOrderOverviewController,
  listPosOrderPaymentsController,
  listPosOrdersController,
  updatePosOrderController,
  updatePosOrderItemController,
} from "./orders.controller.js";

/**
 * POS order routes.
 *
 * Specific paths are registered before `/:orderId` so Hono does not capture
 * `/overview`, `/payments`, or `/items` as a generic order id.
 */
export function createPosOrdersRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listPosOrdersController);
  routes.post("/", createPosOrderController);
  routes.get("/overview", getPosOrderOverviewController);

  routes.get("/:orderId/payments", listPosOrderPaymentsController);
  routes.post("/:orderId/payments", createPosOrderPaymentController);
  routes.post("/:orderId/status-changes", changePosOrderStatusController);
  routes.post("/:orderId/items", createPosOrderItemController);
  routes.patch("/:orderId/items/:itemId", updatePosOrderItemController);
  routes.delete("/:orderId/items/:itemId", deletePosOrderItemController);

  routes.get("/:orderId", getPosOrderController);
  routes.patch("/:orderId", updatePosOrderController);
  routes.delete("/:orderId", deletePosOrderController);

  return routes;
}
