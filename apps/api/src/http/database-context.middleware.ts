import {
  runWithSystemDatabaseContext,
  runWithTenantDatabaseContext,
} from "@cleanhub/db";
import type { MiddlewareHandler } from "hono";

import { AuthError } from "../modules/auth/auth.errors.js";
import type { AppBindings } from "./types.js";

export function createSystemDatabaseContextMiddleware(): MiddlewareHandler<AppBindings> {
  return async (_c, next) => {
    await runWithSystemDatabaseContext(next);
  };
}

export function createTenantDatabaseContextMiddleware(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const tenantId = c.get("authContext").tenantId;
    if (!tenantId) {
      throw new AuthError(
        "FORBIDDEN",
        "A tenant session is required for this resource.",
      );
    }

    await runWithTenantDatabaseContext(tenantId, next);
  };
}

export function createMobileTenantDatabaseContextMiddleware(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    await runWithTenantDatabaseContext(
      c.get("mobileAuthContext").tenantId,
      next,
    );
  };
}
