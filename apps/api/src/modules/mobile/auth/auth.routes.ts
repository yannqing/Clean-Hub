import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { createMobileAuthController } from "./auth.controller.js";
import type { MobileAuthService } from "./auth.service.js";

export type CreateMobileAuthRoutesOptions = {
  mobileAuthService: MobileAuthService;
};

export function createMobileAuthRoutes({
  mobileAuthService,
}: CreateMobileAuthRoutesOptions) {
  const routes = new Hono<AppBindings>();
  const controller = createMobileAuthController({ mobileAuthService });

  routes.get("/customer/login-options", controller.getCustomerLoginOptions);
  routes.post("/customer/otp/request", controller.requestCustomerOtp);
  if (mobileAuthService.isTestOtpEnabled()) {
    routes.get("/customer/otp/test", controller.getCustomerTestOtp);
  }
  routes.post("/customer/otp/verify", controller.verifyCustomerOtp);
  routes.post("/customer/password", controller.loginCustomerWithPassword);
  routes.post("/staff/driver/login", controller.loginDriver);
  routes.post("/staff/owner/login", controller.loginOwner);
  routes.post("/refresh", controller.refresh);
  routes.post("/logout", controller.logout);
  routes.get("/me", controller.me);

  return routes;
}
