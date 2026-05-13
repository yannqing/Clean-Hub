import type { Context } from "hono";

import type { AuthRequestMeta } from "../modules/auth/auth.types.js";
import type { AppBindings } from "./types.js";

export function getRequestMeta(
  c: Context<AppBindings>,
  deviceId?: string,
): AuthRequestMeta {
  const forwardedFor = c.req.header("x-forwarded-for");

  return {
    deviceId: deviceId ?? c.req.header("x-device-id"),
    ipAddress: forwardedFor?.split(",")[0]?.trim(),
    userAgent: c.req.header("user-agent"),
  };
}
