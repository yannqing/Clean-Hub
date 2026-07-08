import { getCookie } from "hono/cookie";

import { getRequestMeta } from "../../http/request-meta.js";
import { appendSetCookieHeaders } from "../../http/response.js";
import type { AppBindings } from "../../http/types.js";
import type { AuthService } from "./auth.service.js";
import {
  loginRequestSchema,
  posPinLoginRequestSchema,
} from "./auth.validation.js";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from "./cookie.service.js";

export type AuthControllerOptions = {
  authService: AuthService;
};

export function createAuthController({ authService }: AuthControllerOptions) {
  return {
    login: async (c: import("hono").Context<AppBindings>) => {
      const body = loginRequestSchema.parse(await c.req.json());
      const result = await authService.login({
        identifier: body.identifier,
        password: body.password,
        tenantCode: body.tenantCode,
        ...getRequestMeta(c, body.deviceId),
      });

      appendSetCookieHeaders(c, result.setCookieHeaders);

      return c.json({
        authContext: result.authContext,
      });
    },

    posPinLogin: async (c: import("hono").Context<AppBindings>) => {
      const body = posPinLoginRequestSchema.parse(await c.req.json());
      const result = await authService.loginWithPosPin({
        pin: body.pin,
        tenantCode: body.tenantCode,
        deviceId: body.deviceId,
        ...getRequestMeta(c, body.deviceId),
      });

      appendSetCookieHeaders(c, result.setCookieHeaders);

      return c.json({
        authContext: result.authContext,
      });
    },

    refresh: async (c: import("hono").Context<AppBindings>) => {
      const refreshToken = getCookie(c, REFRESH_COOKIE_NAME);

      const result = await authService.refresh({
        refreshToken: refreshToken ?? "",
        ...getRequestMeta(c),
      });

      appendSetCookieHeaders(c, result.setCookieHeaders);

      return c.json({
        authContext: result.authContext,
      });
    },

    logout: async (c: import("hono").Context<AppBindings>) => {
      const setCookieHeaders = await authService.logout({
        accessToken: getCookie(c, ACCESS_COOKIE_NAME),
        refreshToken: getCookie(c, REFRESH_COOKIE_NAME),
        ...getRequestMeta(c),
      });

      appendSetCookieHeaders(c, setCookieHeaders);

      return c.body(null, 204);
    },

    me: async (c: import("hono").Context<AppBindings>) => {
      const accessToken = getCookie(c, ACCESS_COOKIE_NAME);
      const authContext = await authService.getAuthContext(accessToken ?? "");

      return c.json(authContext);
    },
  };
}
