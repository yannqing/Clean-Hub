import { Hono } from "hono";

import { createMobileTenantDatabaseContextMiddleware } from "../../http/database-context.middleware.js";
import type { AppBindings } from "../../http/types.js";
import { createMobileAuthMiddleware } from "../../http/mobile-auth.middleware.js";
import { createMobileAuthRoutes } from "./auth/auth.routes.js";
import type { MobileAuthService } from "./auth/auth.service.js";
import { createCustomerRoutes } from "./customer/index.js";
import { createDeliveryRoutes } from "./delivery/index.js";
import { DeliveryService } from "./delivery/index.js";
import { createMediaRoutes } from "../media/index.js";
import {
  NotificationsService,
  type NotificationPublisher,
} from "../notifications/index.js";
import { createMobileNotificationsRoutes } from "./notifications/index.js";
import { createOwnerRoutes } from "./owner/index.js";
import { OwnerService } from "./owner/index.js";
import {
  createPaymentRoutes,
  createPaymentWebhookRoutes,
  PaymentService,
} from "./payment/index.js";

export type CreateMobileRoutesOptions = {
  mobileAuthService: MobileAuthService;
  notificationPublisher?: NotificationPublisher;
};

export function createMobileRoutes({
  mobileAuthService,
  notificationPublisher,
}: CreateMobileRoutesOptions) {
  const routes = new Hono<AppBindings>();
  const notificationsService =
    notificationPublisher ?? new NotificationsService();

  routes.route("/auth", createMobileAuthRoutes({ mobileAuthService }));
  const paymentService = new PaymentService({
    notificationPublisher: notificationsService,
  });

  routes.route("/payment", createPaymentWebhookRoutes({ paymentService }));
  routes.use("/*", createMobileAuthMiddleware(mobileAuthService));
  routes.use("/*", createMobileTenantDatabaseContextMiddleware());
  const ownerService = new OwnerService({
    notificationPublisher: notificationsService,
  });
  const deliveryService = new DeliveryService({
    appointmentOperations: ownerService,
    notificationPublisher: notificationsService,
  });

  routes.route("/media", createMediaRoutes());
  routes.route("/notifications", createMobileNotificationsRoutes());
  routes.route("/customer", createCustomerRoutes());
  routes.route("/delivery", createDeliveryRoutes({ deliveryService }));
  routes.route("/owner", createOwnerRoutes({ ownerService }));
  routes.route("/payment", createPaymentRoutes({ paymentService }));

  return routes;
}
