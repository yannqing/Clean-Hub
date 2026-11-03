import { createId } from "@cleanhub/id";
import type { MiddlewareHandler } from "hono";

import { resolveRequestLocale } from "./locale.js";
import type { AppBindings } from "./types.js";

export function createRequestContextMiddleware(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? createId();

    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    c.set("locale", resolveRequestLocale(c.req.header("accept-language")));

    // Caches and proxies must not serve one terminal's localised errors to a
    // terminal that asked in another language.
    c.header("Vary", "Accept-Language", { append: true });

    await next();
  };
}
