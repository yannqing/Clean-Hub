import type { MiddlewareHandler } from "hono";

import { AuthError } from "../modules/auth/auth.errors.js";
import type { AuthContext } from "../modules/auth/auth.types.js";
import type { AppBindings } from "./types.js";

export function assertNonTerminalWebSession(
  authContext: Pick<AuthContext, "terminalId">,
): void {
  if (authContext.terminalId) {
    throw new AuthError(
      "FORBIDDEN",
      "A POS terminal session cannot access back-office resources.",
    );
  }
}

/**
 * Keeps terminal-bound PIN sessions inside the POS API surface. Password
 * sessions used by the tenant setup flow are not terminal-bound and remain
 * valid for back-office routes.
 */
export function requireNonTerminalWebSession(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    assertNonTerminalWebSession(c.get("authContext"));
    await next();
  };
}
