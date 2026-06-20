import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createPosOrder,
  getPosOrder,
  listPosOrders,
} from "./orders.service.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { requirePathParam } from "../require-path-param.helper.js";
import type {
  CreatePosOrderRequest,
  PosOrderListQuery,
} from "./orders.types.js";

function notImplementedResponse(c: Context<AppBindings>, error: PosNotImplementedError) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function listPosOrdersController(c: Context<AppBindings>) {
  const query = c.req.query() as PosOrderListQuery;
  const result = await listPosOrders({
    authContext: c.get("authContext"),
    query,
  });
  return c.json({ data: result });
}

export async function getPosOrderController(c: Context<AppBindings>) {
  const orderId = requirePathParam(c, "orderId");
  if (orderId instanceof Response) {
    return orderId;
  }
  const order = await getPosOrder({
    authContext: c.get("authContext"),
    orderId,
  });
  return c.json(order);
}

export async function createPosOrderController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = rawBody as CreatePosOrderRequest;

  try {
    const order = await createPosOrder({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data,
    });
    return c.json(order, 201);
  } catch (error) {
    if (error instanceof PosNotImplementedError) {
      return notImplementedResponse(c, error);
    }
    throw error;
  }
}
