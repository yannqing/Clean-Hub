import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createTenantOrderCommentController,
  createTenantOrderItemController,
  createTenantOrderPaymentController,
  createTenantOrderPaymentCorrectionController,
  createTenantOrderRefundController,
  deleteTenantOrderCommentController,
  deleteTenantOrderItemController,
  getTenantOrderDetailController,
  getTenantOrderOverviewController,
  getTenantOrderTimelineController,
  importTenantOrdersController,
  listTenantOrdersController,
  changeTenantOrderStatusController,
  requestTenantOrderAttachmentUploadController,
  updateTenantOrderCommentController,
  updateTenantOrderItemController,
} from "./orders.controller.js";

export function createTenantOrderRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantOrdersController);
  routes.get("/overview", getTenantOrderOverviewController);
  routes.post("/import", importTenantOrdersController);
  routes.post("/media/uploads", requestTenantOrderAttachmentUploadController);
  routes.get("/:orderId/timeline", getTenantOrderTimelineController);
  routes.post("/:orderId/comments", createTenantOrderCommentController);
  routes.post("/:orderId/items", createTenantOrderItemController);
  routes.post("/:orderId/payments", createTenantOrderPaymentController);
  routes.post(
    "/:orderId/payment-adjustments/refunds",
    createTenantOrderRefundController,
  );
  routes.post(
    "/:orderId/payment-adjustments/corrections",
    createTenantOrderPaymentCorrectionController,
  );
  routes.post("/:orderId/status-changes", changeTenantOrderStatusController);
  routes.patch(
    "/:orderId/comments/:commentId",
    updateTenantOrderCommentController,
  );
  routes.delete(
    "/:orderId/comments/:commentId",
    deleteTenantOrderCommentController,
  );
  routes.patch("/:orderId/items/:itemId", updateTenantOrderItemController);
  routes.delete("/:orderId/items/:itemId", deleteTenantOrderItemController);
  routes.get("/:orderId", getTenantOrderDetailController);

  return routes;
}
