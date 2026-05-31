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
import { createSaasAuditRoutes } from "./modules/saas-audit/audit.routes.js";
import {
  createSaasBackupRoutes,
  createSaasRestoreRequestRoutes,
} from "./modules/saas-backups/backups.routes.js";
import { createSaasFeedbackTicketRoutes } from "./modules/saas-feedback/feedback-tickets.routes.js";
import { createSaasOperationLogRoutes } from "./modules/saas-ops/operation-logs.routes.js";
import { createSaasOverviewRoutes } from "./modules/saas-overview/overview.routes.js";
import { createSaasPlatformSettingsRoutes } from "./modules/saas-platform-settings/platform-settings.routes.js";
import { createSaaSTestRoutes } from "./modules/saas/saas.routes.js";
import { createSaasSecurityRoutes } from "./modules/saas-security/security.routes.js";
import { createSaasTenantsRoutes } from "./modules/saas-tenants/tenants.routes.js";
import { createSaasRolesRoutes } from "./modules/saas-users/saas-roles.routes.js";
import { createSaasUsersRoutes } from "./modules/saas-users/saas-users.routes.js";
import { createTenantNotificationRoutes } from "./modules/tenant-notifications/notifications.routes.js";
import { createTenantUserRoutes } from "./modules/users/users.routes.js";

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

  // SaaS 平台 - 公共模块
  app.route("/saas/overview", createSaasOverviewRoutes());
  app.route("/saas/audit-logs", createSaasAuditRoutes());
  app.route("/saas/platform-settings", createSaasPlatformSettingsRoutes());

  // SaaS 平台 - 租户管理
  app.route("/saas/tenants", createSaasTenantsRoutes());

  // SaaS 平台 - 用户与权限
  app.route("/saas/roles", createSaasRolesRoutes());
  app.route("/saas/users", createSaasUsersRoutes());

  // SaaS 平台 - 运营管理
  app.route("/saas/feedback-tickets", createSaasFeedbackTicketRoutes());
  app.route("/saas/backups", createSaasBackupRoutes());
  app.route("/saas/restore-requests", createSaasRestoreRequestRoutes());
  app.route("/saas/operation-logs", createSaasOperationLogRoutes());
  app.route("/saas/security", createSaasSecurityRoutes());

  // 租户侧
  app.route("/tenant/notification-settings", createTenantNotificationRoutes());
  app.route("/tenant/users", createTenantUserRoutes());

  // 测试路由
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
