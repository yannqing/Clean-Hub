import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  archivePosNotificationController,
  getPosNotificationsOverviewController,
  listPosNotificationsController,
  markAllPosNotificationsReadController,
  markPosNotificationReadController,
} from "./notifications.controller.js";

/**
 * POS notification inbox routes.
 */
export function createPosNotificationsRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listPosNotificationsController);
  routes.get("/overview", getPosNotificationsOverviewController);
  routes.patch("/read-all", markAllPosNotificationsReadController);
  routes.patch("/:deliveryId/read", markPosNotificationReadController);
  routes.patch("/:deliveryId/archive", archivePosNotificationController);

  return routes;
}
