import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import type { AuthService } from "./auth.service.js";
import { createAuthController } from "./auth.controller.js";

export type CreateAuthRoutesOptions = {
  authService: AuthService;
};

export function createAuthRoutes({ authService }: CreateAuthRoutesOptions) {
  const routes = new Hono<AppBindings>();
  const controller = createAuthController({ authService });

  routes.post("/login", controller.login);
  routes.post("/refresh", controller.refresh);
  routes.post("/logout", controller.logout);
  routes.get("/me", controller.me);

  return routes;
}
