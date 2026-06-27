import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import { createMobileAuthMiddleware } from "../../http/mobile-auth.middleware.js";
import { createMobileAuthRoutes } from "./auth/auth.routes.js";
import type { MobileAuthService } from "./auth/auth.service.js";
import { createCustomerRoutes } from "./customer/index.js";
import { createDeliveryRoutes } from "./delivery/index.js";
import { createMediaRoutes } from "../media/index.js";
import { createOwnerRoutes } from "./owner/index.js";

export type CreateMobileRoutesOptions = {
  mobileAuthService: MobileAuthService;
};

export function createMobileRoutes({
  mobileAuthService,
}: CreateMobileRoutesOptions) {
  const routes = new Hono<AppBindings>();

  routes.route("/auth", createMobileAuthRoutes({ mobileAuthService }));
  routes.use("/*", createMobileAuthMiddleware(mobileAuthService));
  routes.route("/media", createMediaRoutes());
  routes.route("/customer", createCustomerRoutes());
  routes.route("/delivery", createDeliveryRoutes());
  routes.route("/owner", createOwnerRoutes());

  return routes;
}
