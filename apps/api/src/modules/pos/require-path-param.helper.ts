import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";

/**
 * Read a required path param, returning 400 when it is missing.
 *
 * Hono's `c.req.param()` returns `string | undefined`. Most service inputs
 * type the id as `string`, so this helper narrows it and short-circuits with
 * a clean error response instead of leaking `undefined` into the service layer.
 */
export function requirePathParam(
  c: Context<AppBindings>,
  name: string,
): string | Response {
  const value = c.req.param(name);
  if (!value) {
    return c.json(
      {
        message: `Missing path parameter: ${name}`,
        code: "MISSING_PATH_PARAM",
        requestId: c.get("requestId"),
      },
      400,
    );
  }
  return value;
}
