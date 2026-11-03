import { getDb, runWithSystemDatabaseContext } from "@cleanhub/db";
import type { MiddlewareHandler } from "hono";

import { findPlatformSettings } from "../modules/saas/platform-settings/platform-settings.repository.js";
import type { AppBindings } from "./types.js";

/** Keep reads available while the platform pauses tenant-side mutations. */
export function createTenantMaintenanceMiddleware(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(c.req.method) ||
        c.get("authContext").role === "super_admin") {
      await next();
      return;
    }

    const settings = await runWithSystemDatabaseContext(() =>
      findPlatformSettings(getDb()),
    );
    if (settings?.maintenanceMode) {
      c.header("Retry-After", "60");
      return c.json({
        code: "PLATFORM_MAINTENANCE",
        message: "Platform maintenance is in progress. Please retry later.",
        requestId: c.get("requestId"),
      }, 503);
    }

    await next();
  };
}
