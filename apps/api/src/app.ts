import { createLogger } from "@cleanhub/logger";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { loadApiEnv } from "./config/env.js";
import { handleApiError } from "./http/error-handler.js";
import { createRequireAuthMiddleware } from "./http/auth.middleware.js";
import { createRequestContextMiddleware } from "./http/request-context.middleware.js";
import type { AppBindings } from "./http/types.js";
import { createAuthServiceFromEnv } from "./modules/auth/auth.factory.js";
import { createAuthRoutes } from "./modules/auth/auth.routes.js";
import { createSaasRolesRoutes } from "./modules/saas-users/saas-roles.routes.js";
import { createSaasUsersRoutes } from "./modules/saas-users/saas-users.routes.js";
import { createTenantUserRoutes } from "./modules/users/users.routes.js";
import { createSaaSTestRoutes } from "./modules/saas/saas.routes.js";

export type CreateApiAppOptions = {
  env?: NodeJS.ProcessEnv;
};

export function createApiApp({ env = process.env }: CreateApiAppOptions = {}) {
  const apiEnv = loadApiEnv(env);
  const logger = createLogger({
    name: "api",
    service: "cleanhub-api",
  });
  const authService = createAuthServiceFromEnv({ env });
  const app = new Hono<AppBindings>();

  app.use("*", async (c, next) => {
    c.set("logger", logger);
    await next();
  });

  app.use("*", createRequestContextMiddleware());

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) {
          return null;
        }

        return apiEnv.corsOrigins.includes(origin) ? origin : null;
      },
      allowHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-Device-Id"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    }),
  );

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "cleanhub-api",
    }),
  );

  app.route("/auth", createAuthRoutes({ authService }));
  app.use("/saas/*", createRequireAuthMiddleware(authService));
  app.use("/tenant/*", createRequireAuthMiddleware(authService));
  app.route("/saas/roles", createSaasRolesRoutes());
  app.route("/saas/users", createSaasUsersRoutes());
  app.route("/tenant/users", createTenantUserRoutes());

  app.route("/saas/test/user", createSaaSTestRoutes());

  app.notFound((c) =>
    c.json(
      {
        message: "Route not found.",
        code: "NOT_FOUND",
        requestId: c.get("requestId"),
      },
      404,
    ),
  );

  app.onError((error, c) => handleApiError(error, c));

  return {
    app,
    env: apiEnv,
    logger,
  };
}
