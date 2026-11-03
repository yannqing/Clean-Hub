import type { MiddlewareHandler } from "hono";
import { AuthError } from "../modules/auth/auth.errors.js";
import type { AppBindings } from "./types.js";

export function createMobileCapabilitiesMiddleware(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const createsDelivery = c.req.method === "POST" && (
      c.req.path === "/mobile/customer/appointments" ||
      c.req.path === "/mobile/delivery/tasks" ||
      /^\/mobile\/owner\/appointments\/[^/]+\/accept$/.test(c.req.path)
    );
    // Existing tasks remain readable and may be safely finished/cancelled.
    if (createsDelivery && c.get("mobileAuthContext").deliveryEnabled !== true) {
      throw new AuthError("FEATURE_DISABLED", "Pickup and delivery are not enabled for this tenant.");
    }
    await next();
  };
}
