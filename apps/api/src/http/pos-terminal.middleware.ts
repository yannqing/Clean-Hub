import type { MiddlewareHandler } from "hono";

import type { AuthContext } from "../modules/auth/auth.types.js";
import { requirePosTerminalContext } from "../modules/pos/access-control.helper.js";
import type { AppBindings } from "./types.js";
import { assertNonTerminalWebSession } from "./web-session.middleware.js";

const POS_TERMINAL_SETUP_ROUTES = [
  { method: "POST", pattern: /^\/pos\/auth\/devices$/ },
  { method: "GET", pattern: /^\/pos\/auth\/devices\/[^/]+$/ },
  { method: "PATCH", pattern: /^\/pos\/auth\/devices\/[^/]+$/ },
  {
    method: "POST",
    pattern: /^\/pos\/auth\/devices\/[^/]+\/credential-rotation$/,
  },
  {
    method: "POST",
    pattern: /^\/pos\/auth\/devices\/[^/]+\/revocation$/,
  },
  { method: "GET", pattern: /^\/pos\/auth\/terminals\/[^/]+$/ },
  { method: "PATCH", pattern: /^\/pos\/auth\/terminals\/[^/]+\/lock$/ },
] as const;

export function isPosTerminalSetupRequest(
  method: string,
  path: string,
): boolean {
  return POS_TERMINAL_SETUP_ROUTES.some(
    (route) => route.method === method && route.pattern.test(path),
  );
}

export function assertPosTerminalManagementSession(
  authContext: Pick<AuthContext, "terminalId">,
): void {
  assertNonTerminalWebSession(authContext);
}

export function createRequirePosTerminalMiddleware(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const path = c.req.path;

    // Terminal enrollment and lifecycle operations require a password-backed
    // setup/back-office session. A terminal-bound Owner/Manager PIN session
    // must never rotate another terminal's credential and take over its audit
    // identity. The service layer still enforces role and branch scope.
    if (isPosTerminalSetupRequest(c.req.method, path)) {
      assertPosTerminalManagementSession(c.get("authContext"));
      await next();
      return;
    }

    requirePosTerminalContext(c.get("authContext"));
    await next();
  };
}
