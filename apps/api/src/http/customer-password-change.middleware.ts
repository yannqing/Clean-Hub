import type { MiddlewareHandler } from "hono";

import { AuthError } from "../modules/auth/auth.errors.js";
import type { AppBindings } from "./types.js";

/**
 * The one thing an account still on the starter password may do.
 *
 * Matched on the path the mobile routes are mounted under, and kept to a single
 * exact route: every other customer endpoint stays closed until a real password
 * is set.
 */
const CHANGE_PASSWORD_PATH = "/mobile/customer/password";

/**
 * Hold a customer to the change-password screen while they still carry the
 * shared starter password.
 *
 * Staff hand out the same starter value to everyone, so an account that has not
 * moved off it is protected by nothing but its phone number. This is what makes
 * that acceptable: until the password changes, the session can reach the
 * change-password endpoint and nothing else -- no orders, no addresses, no
 * refund requests.
 *
 * Enforced on the server rather than by hiding screens in the app, because the
 * API is reachable directly and a client-side gate would protect nobody.
 */
export function createCustomerPasswordChangeMiddleware(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const authContext = c.get("mobileAuthContext");

    if (
      authContext.subjectType === "customer" &&
      authContext.mustChangePassword &&
      !(c.req.method === "POST" && c.req.path === CHANGE_PASSWORD_PATH)
    ) {
      throw new AuthError(
        "PASSWORD_CHANGE_REQUIRED",
        "Set a new password before using the app.",
      );
    }

    await next();
  };
}
