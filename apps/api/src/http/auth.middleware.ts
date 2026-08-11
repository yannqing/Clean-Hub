import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";

import { AuthError } from "../modules/auth/auth.errors.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import {
  AUTH_CLIENT_HEADER_NAME,
  resolveAuthCookieNames,
} from "../modules/auth/cookie.service.js";
import type { AppBindings } from "./types.js";

export function createRequireAuthMiddleware(
  authService: AuthService,
): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const cookieNames = resolveAuthCookieNames(
      c.req.header(AUTH_CLIENT_HEADER_NAME),
    );
    const accessToken = getCookie(c, cookieNames.access);

    if (!accessToken) {
      throw new AuthError("TOKEN_INVALID", "Access token is required.");
    }

    const authContext = await authService.getAuthContext(accessToken);

    c.set("authContext", authContext);

    await next();
  };
}
