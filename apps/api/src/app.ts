import { createLogger } from "@cleanhub/logger";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { loadApiEnv } from "./config/env.js";
import { handleApiError } from "./http/error-handler.js";
import { createRequireAuthMiddleware } from "./http/auth.middleware.js";
import {
  isUnsafeRequestOriginAllowed,
  resolveCredentialedCorsOrigin,
} from "./http/cors-origin.js";
import { createRequirePosTerminalMiddleware } from "./http/pos-terminal.middleware.js";
import { createRequestContextMiddleware } from "./http/request-context.middleware.js";
import type { AppBindings } from "./http/types.js";
import { requireNonTerminalWebSession } from "./http/web-session.middleware.js";
import { createAuthServiceFromEnv } from "./modules/auth/auth.factory.js";
import { createAuthRoutes } from "./modules/auth/auth.routes.js";
import { resolveAuthCookieSecure } from "./modules/auth/cookie.service.js";
import { createMobileAuthServiceFromEnv } from "./modules/mobile/auth/auth.service.js";
import { createMobileRoutes } from "./modules/mobile/mobile.routes.js";
import { NotificationsService } from "./modules/notifications/index.js";
import { createSaasAuditRoutes } from "./modules/saas/audit/audit.routes.js";
import {
  createSaasBackupRoutes,
  createSaasRestoreRequestRoutes,
} from "./modules/saas/backups/backups.routes.js";
import { createSaasFeedbackTicketRoutes } from "./modules/saas/feedback/feedback-tickets.routes.js";
import { createSaasOperationLogRoutes } from "./modules/saas/ops/operation-logs.routes.js";
import { createSaasOverviewRoutes } from "./modules/saas/overview/overview.routes.js";
import { createSaasPlatformSettingsRoutes } from "./modules/saas/platform-settings/platform-settings.routes.js";
import { createSaasSecurityRoutes } from "./modules/saas/security/security.routes.js";
import { createSaasTenantsRoutes } from "./modules/saas/tenants/tenants.routes.js";
import { createSaasRolesRoutes } from "./modules/saas/users/saas-roles.routes.js";
import { createSaasUsersRoutes } from "./modules/saas/users/saas-users.routes.js";
import { createTenantAuditRoutes } from "./modules/tenant/audit/audit.routes.js";
import { createTenantBackupRoutes } from "./modules/tenant/backups/backups.routes.js";
import { createTenantCustomerRoutes } from "./modules/tenant/customers/customers.routes.js";
import { createTenantDiscountRoutes } from "./modules/tenant/discounts/discounts.routes.js";
import { createTenantFinanceRoutes } from "./modules/tenant/finance/finance.routes.js";
import { createTenantHardwareRoutes } from "./modules/tenant/hardware/hardware.routes.js";
import { createTenantBranchRoutes } from "./modules/tenant/branches/branches.routes.js";
import { createTenantNotificationsRoutes } from "./modules/tenant/notifications/notifications.routes.js";
import { createTenantOrderRoutes } from "./modules/tenant/orders/orders.routes.js";
import { createTenantOverviewRoutes } from "./modules/tenant/overview/overview.routes.js";
import { createTenantPosChannelRoutes } from "./modules/tenant/pos-channel/pos-channel.routes.js";
import { createTenantProfileRoutes } from "./modules/tenant/profile/profile.routes.js";
import { createTenantProductRoutes } from "./modules/tenant/products/products.routes.js";
import { createTenantReportRoutes } from "./modules/tenant/reports/reports.routes.js";
import { createTenantSearchRoutes } from "./modules/tenant/search/search.routes.js";
import { createTenantServiceCategoryRoutes } from "./modules/tenant/service-categories/service-categories.routes.js";
import { createTenantServiceRoutes } from "./modules/tenant/services/services.routes.js";
import { createTenantSettingsRoutes } from "./modules/tenant/settings/settings.routes.js";
import { createTenantUsersRoutes } from "./modules/tenant/users/tenant-users.routes.js";
import { createPosRoutes } from "./modules/pos/pos.routes.js";

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
  const authCookieSecure = resolveAuthCookieSecure(env);
  const mobileAuthService = createMobileAuthServiceFromEnv({ env });
  const notificationsService = new NotificationsService({ env });
  const app = new Hono<AppBindings>();

  app.use("*", async (c, next) => {
    c.set("logger", logger);
    await next();
  });

  app.use("*", createRequestContextMiddleware());

  app.use("*", async (c, next) => {
    if (
      !isUnsafeRequestOriginAllowed({
        method: c.req.method,
        origin: c.req.header("origin"),
        allowedOrigins: apiEnv.corsOrigins,
        enforceSameOrigin: apiEnv.corsEnforceSameOrigin,
        requestUrl: c.req.url,
        forwardedProto: c.req.header("x-forwarded-proto"),
        forwardedHost: c.req.header("x-forwarded-host"),
        secFetchSite: c.req.header("sec-fetch-site"),
      })
    ) {
      return c.json(
        {
          message: "Cross-origin state-changing request is not allowed.",
          code: "CROSS_ORIGIN_REQUEST_FORBIDDEN",
          requestId: c.get("requestId"),
        },
        403,
      );
    }

    await next();
  });

  app.use(
    "*",
    cors({
      origin: (origin, c) =>
        resolveCredentialedCorsOrigin({
          origin,
          allowedOrigins: apiEnv.corsOrigins,
          enforceSameOrigin: apiEnv.corsEnforceSameOrigin,
          requestUrl: c.req.url,
          forwardedProto: c.req.header("x-forwarded-proto"),
          forwardedHost: c.req.header("x-forwarded-host"),
        }),
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-Id",
        "X-Device-Id",
        "X-CleanHub-Auth-Client",
        "Idempotency-Key",
      ],
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
  app.route(
    "/mobile",
    createMobileRoutes({
      mobileAuthService,
      notificationPublisher: notificationsService,
    }),
  );

  app.use("/saas/*", createRequireAuthMiddleware(authService));
  app.use("/saas/*", requireNonTerminalWebSession());
  app.use("/tenant/*", createRequireAuthMiddleware(authService));
  app.use("/tenant/*", requireNonTerminalWebSession());
  app.use("/pos/*", createRequireAuthMiddleware(authService));
  app.use("/pos/*", createRequirePosTerminalMiddleware());

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
  app.route("/tenant/overview", createTenantOverviewRoutes());
  app.route("/tenant/settings", createTenantSettingsRoutes());
  app.route("/tenant/branches", createTenantBranchRoutes());
  app.route("/tenant/customers", createTenantCustomerRoutes());
  app.route("/tenant/orders", createTenantOrderRoutes());
  app.route("/tenant/audit-logs", createTenantAuditRoutes());
  app.route("/tenant/hardware-configs", createTenantHardwareRoutes());
  app.route("/tenant/notifications", createTenantNotificationsRoutes());
  app.route("/tenant/service-categories", createTenantServiceCategoryRoutes());
  app.route("/tenant/services", createTenantServiceRoutes());
  app.route("/tenant/profile", createTenantProfileRoutes());
  app.route("/tenant/products", createTenantProductRoutes());
  app.route("/tenant/backups", createTenantBackupRoutes());
  app.route("/tenant/discounts", createTenantDiscountRoutes());
  app.route("/tenant/finance", createTenantFinanceRoutes());
  app.route("/tenant/pos-channel", createTenantPosChannelRoutes());
  app.route("/tenant/reports", createTenantReportRoutes());
  app.route("/tenant/search", createTenantSearchRoutes());
  app.route("/tenant/users", createTenantUsersRoutes());

  // POS 终端侧（收银员 / 店长 / 店主）
  app.route(
    "/pos",
    createPosRoutes({
      notificationPublisher: notificationsService,
      terminalCredentialCookieSecure: authCookieSecure,
    }),
  );

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
