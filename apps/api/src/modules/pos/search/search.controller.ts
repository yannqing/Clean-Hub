import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { searchPosGlobalService } from "./search.service.js";
import { posGlobalSearchQuerySchema } from "./search.validation.js";

export async function searchPosGlobalController(c: Context<AppBindings>) {
  const query = posGlobalSearchQuerySchema.parse(c.req.query());
  const result = await searchPosGlobalService({
    authContext: c.get("authContext"),
    query,
  });

  return c.json(result);
}
