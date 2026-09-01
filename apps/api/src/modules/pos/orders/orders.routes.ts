import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import type { NotificationPublisher } from "../../notifications/index.js";
import {
  applyPosOrderDiscountController,
  removePosOrderDiscountController,
} from "../discounts/discounts.controller.js";
import {
  changePosOrderStatusController,
  confirmPosManualPaymentController,
  createPosOrderCheckoutController,
  createPosOrderController,
  createPosOrderItemController,
  createPosOrderPaymentController,
  deletePosOrderController,
  deletePosOrderItemController,
  failPosManualPaymentController,
  getPosOrderController,
  getPosOrderOverviewController,
  listPosOrderPaymentsController,
  listPosOrdersController,
  recordPosCardPaymentOutcomeController,
  updatePosOrderController,
  updatePosOrderItemController,
} from "./orders.controller.js";
import { deliverPosOrderReceiptController } from "../receipts/receipts.controller.js";
import {
  createPosProductReturnController,
  getPosProductReturnsController,
} from "../returns/returns.controller.js";

/**
 * POS order routes.
 *
 * Specific paths are registered before `/:orderId` so Hono does not capture
 * `/overview`, `/payments`, or `/items` as a generic order id.
 */
export type CreatePosOrdersRoutesOptions = {
  notificationPublisher?: NotificationPublisher;
};

export function createPosOrdersRoutes({
  notificationPublisher,
}: CreatePosOrdersRoutesOptions = {}) {
  const routes = new Hono<AppBindings>();

  routes.get("/", listPosOrdersController);
  routes.post("/", createPosOrderController({ notificationPublisher }));
  routes.get("/overview", getPosOrderOverviewController);
  routes.post(
    "/checkout",
    createPosOrderCheckoutController({ notificationPublisher }),
  );

  routes.get("/:orderId/payments", listPosOrderPaymentsController);
  routes.post(
    "/:orderId/receipt-deliveries",
    deliverPosOrderReceiptController,
  );
  routes.get("/:orderId/product-returns", getPosProductReturnsController);
  routes.post("/:orderId/product-returns", createPosProductReturnController);
  routes.post("/:orderId/payments", createPosOrderPaymentController);
  routes.post(
    "/:orderId/payments/:paymentId/confirm",
    confirmPosManualPaymentController,
  );
  routes.post(
    "/:orderId/payments/:paymentId/fail",
    failPosManualPaymentController,
  );
  routes.post(
    "/:orderId/payments/:paymentId/card-outcome",
    recordPosCardPaymentOutcomeController,
  );
  routes.post("/:orderId/status-changes", changePosOrderStatusController);
  routes.post("/:orderId/discounts", applyPosOrderDiscountController);
  routes.delete(
    "/:orderId/discounts/:applicationId",
    removePosOrderDiscountController,
  );
  routes.post("/:orderId/items", createPosOrderItemController);
  routes.patch("/:orderId/items/:itemId", updatePosOrderItemController);
  routes.delete("/:orderId/items/:itemId", deletePosOrderItemController);

  routes.get("/:orderId", getPosOrderController);
  routes.patch("/:orderId", updatePosOrderController);
  routes.delete("/:orderId", deletePosOrderController);

  return routes;
}
