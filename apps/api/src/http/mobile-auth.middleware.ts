import type { MiddlewareHandler } from "hono";

import { runWithSystemDatabaseContext } from "@cleanhub/db";

import { AuthError } from "../modules/auth/auth.errors.js";
import type { MobileAuthService } from "../modules/mobile/auth/auth.service.js";
import type { AppBindings } from "./types.js";

export function createMobileAuthMiddleware(
  mobileAuthService: MobileAuthService,
): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const authorization = c.req.header("authorization");

    if (!authorization?.toLowerCase().startsWith("bearer ")) {
      throw new AuthError("TOKEN_INVALID", "Bearer access token is required.");
    }

    const accessToken = authorization.slice("Bearer ".length).trim();

    if (!accessToken) {
      throw new AuthError("TOKEN_INVALID", "Bearer access token is required.");
    }

    c.set(
      "mobileAuthContext",
      await runWithSystemDatabaseContext(() =>
        mobileAuthService.getMobileAuthContext(accessToken),
      ),
    );

    await next();
  };
}
