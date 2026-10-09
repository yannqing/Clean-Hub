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

  // Customers do not pay through the app: staff collect payment at the counter
  // through the POS, which is the only path that moves real money. The app
  // shows what was collected, so payment status stays readable here while
  // initiating a payment and self-confirming one are deliberately absent.
  //
  // Both removed routes were unsafe to ship: `createPayment` reached a gateway
  // that only has a mock implementation, and `mock-callback` let an
  // authenticated customer mark their own order paid. The service methods
  // behind them are kept for the POS-side and webhook flows, and for when a
  // real PSP is integrated.
  routes.get("/payments/:paymentId", controller.getPaymentStatus);
  routes.post("/orders/:orderId/refund-requests", controller.createRefundRequest);
  routes.get("/refund-requests", controller.listRefundRequests);
  routes.get(
    "/refund-requests/:refundRequestId/order",
    controller.getRefundOrderDetail,
  );
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
