import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { posOrderParamsSchema } from "../orders/orders.validation.js";
import {
  createPosProductReturn,
  getPosProductReturns,
} from "./returns.service.js";
import { createPosProductReturnBodySchema } from "./returns.validation.js";

export async function getPosProductReturnsController(c: Context<AppBindings>) {
  const { orderId } = posOrderParamsSchema.parse(c.req.param());
  return c.json(await getPosProductReturns(c.get("authContext"), orderId));
}

export async function createPosProductReturnController(c: Context<AppBindings>) {
  const { orderId } = posOrderParamsSchema.parse(c.req.param());
  const data = createPosProductReturnBodySchema.parse(await c.req.json());
  const result = await createPosProductReturn({
    authContext: c.get("authContext"),
    orderId,
    data,
    requestMeta: getRequestMeta(c),
  });
  return c.json(result, 201);
}
