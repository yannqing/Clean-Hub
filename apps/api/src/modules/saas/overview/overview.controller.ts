import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getSaasOverview } from "./overview.service.js";

export async function getSaasOverviewController(c: Context<AppBindings>) {
  const overview = await getSaasOverview({ authContext: c.get("authContext") });

  return c.json(overview);
}
