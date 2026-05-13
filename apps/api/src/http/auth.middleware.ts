import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";

import { AuthError } from "../modules/auth/auth.errors.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import { ACCESS_COOKIE_NAME } from "../modules/auth/cookie.service.js";
import type { AppBindings } from "./types.js";

export function createRequireAuthMiddleware(
  authService: AuthService,
): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const accessToken = getCookie(c, ACCESS_COOKIE_NAME);

    if (!accessToken) {
      throw new AuthError("TOKEN_INVALID", "Access token is required.");
    }

    const authContext = await authService.getAuthContext(accessToken);

    c.set("authContext", authContext);

    await next();
  };
}
