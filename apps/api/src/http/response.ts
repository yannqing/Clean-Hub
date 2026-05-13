import type { Context } from "hono";

import type { AppBindings } from "./types.js";

export function appendSetCookieHeaders(
  c: Context<AppBindings>,
  setCookieHeaders: string[],
): void {
  for (const setCookieHeader of setCookieHeaders) {
    c.header("Set-Cookie", setCookieHeader, { append: true });
  }
}
