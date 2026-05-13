import { createId } from "@cleanhub/id";
import type { MiddlewareHandler } from "hono";

import type { AppBindings } from "./types.js";

export function createRequestContextMiddleware(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? createId();

    c.set("requestId", requestId);
    c.header("x-request-id", requestId);

    await next();
  };
}
