import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  archiveTenantNotificationController,
  getTenantNotificationsOverviewController,
  listTenantNotificationsController,
  markAllTenantNotificationsReadController,
  markTenantNotificationReadController,
} from "./notifications.controller.js";

/**
 * Tenant back-office notification inbox routes.
 */
export function createTenantNotificationsRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantNotificationsController);
  routes.get("/overview", getTenantNotificationsOverviewController);
  routes.patch("/read-all", markAllTenantNotificationsReadController);
  routes.patch("/:deliveryId/read", markTenantNotificationReadController);
  routes.patch("/:deliveryId/archive", archiveTenantNotificationController);

  return routes;
}
