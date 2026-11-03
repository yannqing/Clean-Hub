import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createPaymentCorrectionController,
  createRefundController,
  listPaymentAdjustmentsController,
  resolveRefundController,
} from "./payment-adjustments.controller.js";

export function createPosPaymentAdjustmentRoutes() {
  const routes = new Hono<AppBindings>();
  routes.get("/", listPaymentAdjustmentsController);
  routes.post("/refunds", createRefundController);
  routes.post("/:adjustmentId/refund-outcome", resolveRefundController);
  routes.post("/corrections", createPaymentCorrectionController);
  return routes;
}
