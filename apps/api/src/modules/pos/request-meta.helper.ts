import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";
import type { AuthRequestMeta } from "../auth/auth.types.js";

/**
 * Build AuthRequestMeta from a request, omitting empty headers rather than
 * passing `undefined` into optional-but-typed fields.
 */
export function getRequestMeta(
  c: Context<AppBindings>,
): AuthRequestMeta | undefined {
  const ipAddress =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    undefined;
  const userAgent = c.req.header("user-agent") || undefined;

  const meta: AuthRequestMeta = {};
  if (ipAddress) meta.ipAddress = ipAddress;
  if (userAgent) meta.userAgent = userAgent;

  return Object.keys(meta).length > 0 ? meta : undefined;
}
