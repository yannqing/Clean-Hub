import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  listPosCatalogProducts,
  listPosCatalogServices,
} from "./catalog.service.js";
import { posCatalogQuerySchema } from "./catalog.validation.js";

export async function listPosCatalogController(c: Context<AppBindings>) {
  const query = posCatalogQuerySchema.parse(c.req.query());
  const input = { authContext: c.get("authContext"), query };
  const [data, products] = await Promise.all([
    listPosCatalogServices(input),
    listPosCatalogProducts(input),
  ]);
  return c.json({ data, products });
}
