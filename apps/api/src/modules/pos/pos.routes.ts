import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import type { NotificationPublisher } from "../notifications/index.js";
import { createPosAuthRoutes } from "./auth/auth.routes.js";
import { getMyPosBranchController } from "./branches/pos.controller.js";
import { createPosCatalogRoutes } from "./catalog/catalog.routes.js";
import {
  createPosAccountsRoutes,
  createPosCustomersRoutes,
} from "./customers/customers.routes.js";
import { createPosNotificationsRoutes } from "./notifications/notifications.routes.js";
import { createPosOrdersRoutes } from "./orders/orders.routes.js";
import { createPosOverviewRoutes } from "./overview/overview.routes.js";
import { createPosPaymentAdjustmentRoutes } from "./payment-adjustments/payment-adjustments.routes.js";
import { createPosReceptionRoutes } from "./reception/reception.routes.js";
import { createPosSearchRoutes } from "./search/search.routes.js";
import { createPosStaffRoutes } from "./staff/staff.routes.js";
import { createPosServiceTicketsRoutes } from "./service-tickets/service-tickets.routes.js";
import { createPosTerminalSettingsRoutes } from "./terminal-settings/terminal-settings.routes.js";
import { createPosHardwareRoutes } from "./hardware/hardware.routes.js";
import { createPosStatisticsRoutes } from "./statistics/statistics.routes.js";
import { createPosWorkspaceRoutes } from "./workspace/workspace.routes.js";

export type CreatePosRoutesOptions = {
  notificationPublisher?: NotificationPublisher;
};

export function createPosRoutes({
  notificationPublisher,
}: CreatePosRoutesOptions = {}) {
  const routes = new Hono<AppBindings>();

  // GET /pos/branches/me — the active branch for the signed-in POS user.
  routes.get("/branches/me", getMyPosBranchController);

  // Scaffold resources — handlers exist, service layer returns 501 until
  // the repository implementations land.
  routes.route("/auth", createPosAuthRoutes());
  routes.route("/customers", createPosCustomersRoutes());
  routes.route("/catalog", createPosCatalogRoutes());
  routes.route("/service-tickets", createPosServiceTicketsRoutes());
  routes.route("/accounts", createPosAccountsRoutes());
  routes.route("/orders", createPosOrdersRoutes({ notificationPublisher }));
  routes.route("/payment-adjustments", createPosPaymentAdjustmentRoutes());
  routes.route("/search", createPosSearchRoutes());
  routes.route("/overview", createPosOverviewRoutes());
  routes.route("/staff", createPosStaffRoutes());
  routes.route("/reception", createPosReceptionRoutes());
  routes.route("/notifications", createPosNotificationsRoutes());
  routes.route("/terminal-settings", createPosTerminalSettingsRoutes());
  routes.route("/hardware-devices", createPosHardwareRoutes());
  routes.route("/statistics", createPosStatisticsRoutes());
  routes.route("/workspace", createPosWorkspaceRoutes());

  return routes;
}
