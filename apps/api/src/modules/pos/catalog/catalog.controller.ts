import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { listPosCatalogServices } from "./catalog.service.js";
import { posCatalogQuerySchema } from "./catalog.validation.js";

export async function listPosCatalogController(c: Context<AppBindings>) {
  const query = posCatalogQuerySchema.parse(c.req.query());
  const data = await listPosCatalogServices({
    authContext: c.get("authContext"),
    query,
  });
  return c.json({ data });
}
