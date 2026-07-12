import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { createMobileNotificationsController } from "./notifications.controller.js";
import { MobileNotificationsService } from "./notifications.service.js";

export type CreateMobileNotificationsRoutesOptions = {
  notificationsService?: MobileNotificationsService;
};

export function createMobileNotificationsRoutes({
  notificationsService = new MobileNotificationsService(),
}: CreateMobileNotificationsRoutesOptions = {}) {
  const routes = new Hono<AppBindings>();
  const controller = createMobileNotificationsController({
    notificationsService,
  });

  routes.post("/device-tokens", controller.registerDeviceToken);
  routes.delete("/device-tokens", controller.unregisterDeviceToken);

  return routes;
}
