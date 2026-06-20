import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  listPosNotificationsController,
  markAllPosNotificationsReadController,
  markPosNotificationReadController,
} from "./notifications.controller.js";

/**
 * POS notification routes. Scaffold: handlers exist, service returns 501.
 */
export function createPosNotificationsRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listPosNotificationsController);
  routes.patch("/read-all", markAllPosNotificationsReadController);
  routes.patch("/:notificationId", markPosNotificationReadController);

  return routes;
}
