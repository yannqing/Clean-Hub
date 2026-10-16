import { getCookie } from "hono/cookie";

import { getRequestMeta } from "../../http/request-meta.js";
import { appendSetCookieHeaders } from "../../http/response.js";
import type { AppBindings } from "../../http/types.js";
import type { AuthService } from "./auth.service.js";
import {
  loginRequestSchema,
  posBootstrapRequestSchema,
  posPinLoginRequestSchema,
} from "./auth.validation.js";
import {
  AUTH_CLIENT_HEADER_NAME,
  resolveAuthCookieNames,
  scopeAuthCookieHeaders,
} from "./cookie.service.js";
import { POS_TERMINAL_CREDENTIAL_COOKIE_NAME } from "./pos-terminal-credential.js";

export type AuthControllerOptions = {
  authService: AuthService;
};

function getAuthCookieContext(c: import("hono").Context<AppBindings>) {
  const authClient = c.req.header(AUTH_CLIENT_HEADER_NAME);
  return {
    authClient,
    names: resolveAuthCookieNames(authClient),
  };
}

function appendScopedAuthCookieHeaders(
  c: import("hono").Context<AppBindings>,
  headers: string[],
  authClient: string | undefined,
) {
  appendSetCookieHeaders(c, scopeAuthCookieHeaders(headers, authClient));
}

export function createAuthController({ authService }: AuthControllerOptions) {
  return {
    login: async (c: import("hono").Context<AppBindings>) => {
      const { authClient } = getAuthCookieContext(c);
      const body = loginRequestSchema.parse(await c.req.json());
      const result = await authService.login({
        identifier: body.identifier,
        password: body.password,
        ...getRequestMeta(c, body.deviceId),
      });

      appendScopedAuthCookieHeaders(c, result.setCookieHeaders, authClient);

      return c.json({
        authContext: result.authContext,
      });
    },

    posBootstrap: async (c: import("hono").Context<AppBindings>) => {
      const { names } = getAuthCookieContext(c);
      const body = posBootstrapRequestSchema.parse(await c.req.json());
      const state = await authService.getPosBootstrapState({
        deviceId: body.deviceId,
        accessToken: getCookie(c, names.access),
        terminalCredential: getCookie(c, POS_TERMINAL_CREDENTIAL_COOKIE_NAME),
      });

      return c.json(state);
    },

    posPinLogin: async (c: import("hono").Context<AppBindings>) => {
      const { authClient } = getAuthCookieContext(c);
      const body = posPinLoginRequestSchema.parse(await c.req.json());
      const result = await authService.loginWithPosPin({
        pin: body.pin,
        deviceId: body.deviceId,
        terminalCredential: getCookie(c, POS_TERMINAL_CREDENTIAL_COOKIE_NAME),
        ...getRequestMeta(c, body.deviceId),
      });

      appendScopedAuthCookieHeaders(c, result.setCookieHeaders, authClient);

      return c.json({
        authContext: result.authContext,
      });
    },

    refresh: async (c: import("hono").Context<AppBindings>) => {
      const { authClient, names } = getAuthCookieContext(c);
      const refreshToken = getCookie(c, names.refresh);

      const result = await authService.refresh({
        refreshToken: refreshToken ?? "",
        terminalCredential: getCookie(c, POS_TERMINAL_CREDENTIAL_COOKIE_NAME),
        ...getRequestMeta(c),
      });

      appendScopedAuthCookieHeaders(c, result.setCookieHeaders, authClient);

      return c.json({
        authContext: result.authContext,
      });
    },

    logout: async (c: import("hono").Context<AppBindings>) => {
      const { authClient, names } = getAuthCookieContext(c);
      const setCookieHeaders = await authService.logout({
        accessToken: getCookie(c, names.access),
        refreshToken: getCookie(c, names.refresh),
        ...getRequestMeta(c),
      });

      appendScopedAuthCookieHeaders(c, setCookieHeaders, authClient);

      return c.body(null, 204);
    },

    me: async (c: import("hono").Context<AppBindings>) => {
      const { names } = getAuthCookieContext(c);
      const accessToken = getCookie(c, names.access);
      const authContext = await authService.getAuthContext(accessToken ?? "");

      return c.json(authContext);
    },
  };
}
