import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { createPaymentController } from "./payment.controller.js";
import { PaymentService } from "./payment.service.js";

export type CreatePaymentRoutesOptions = {
  paymentService?: PaymentService;
};

export function createPaymentWebhookRoutes({
  paymentService = new PaymentService(),
}: CreatePaymentRoutesOptions = {}) {
  const routes = new Hono<AppBindings>();
  const controller = createPaymentController({ paymentService });

  routes.post("/webhooks/:gateway", controller.handleWebhook);

  return routes;
}

export function createPaymentRoutes({
  paymentService = new PaymentService(),
}: CreatePaymentRoutesOptions = {}) {
  const routes = new Hono<AppBindings>();
  const controller = createPaymentController({ paymentService });

  routes.post("/orders/:orderId/payments", controller.createPayment);
  routes.get("/payments/:paymentId", controller.getPaymentStatus);
  routes.post("/payments/:paymentId/mock-callback", controller.simulateMockPayment);
  routes.post("/orders/:orderId/refund-requests", controller.createRefundRequest);
  routes.get("/refund-requests", controller.listRefundRequests);
  routes.post(
    "/refund-requests/:refundRequestId/approve",
    controller.approveRefundRequest,
  );
  routes.post(
    "/refund-requests/:refundRequestId/reject",
    controller.rejectRefundRequest,
  );

  return routes;
}
