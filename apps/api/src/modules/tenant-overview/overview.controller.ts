import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";
import { getTenantOverview } from "./overview.service.js";

export async function getTenantOverviewController(c: Context<AppBindings>) {
  const overview = await getTenantOverview({
    authContext: c.get("authContext"),
  });

  return c.json(overview);
}
