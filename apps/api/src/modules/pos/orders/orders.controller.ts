import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { PosOrderError } from "./orders.errors.js";
import {
  changePosOrderStatus,
  createPosOrder,
  createPosOrderItem,
  createPosOrderPayment,
  deletePosOrder,
  deletePosOrderItem,
  getPosOrder,
  getPosOrderOverview,
  listPosOrderPayments,
  listPosOrders,
  updatePosOrder,
  updatePosOrderItem,
} from "./orders.service.js";
import {
  changePosOrderStatusBodySchema,
  createPosOrderBodySchema,
  createPosOrderItemBodySchema,
  createPosPaymentBodySchema,
  posOrderItemParamsSchema,
  posOrderListQuerySchema,
  posOrderOverviewQuerySchema,
  posOrderParamsSchema,
  updatePosOrderBodySchema,
  updatePosOrderItemBodySchema,
} from "./orders.validation.js";

function createErrorResponse(c: Context<AppBindings>, error: PosOrderError) {
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
  const query = posOrderListQuerySchema.parse(c.req.query());
  const result = await listPosOrders({
    authContext: c.get("authContext"),
    query,
  });
  return c.json(result);
}

export async function getPosOrderOverviewController(c: Context<AppBindings>) {
  const query = posOrderOverviewQuerySchema.parse(c.req.query());
  const overview = await getPosOrderOverview(c.get("authContext"), query);
  return c.json(overview);
}

export async function getPosOrderController(c: Context<AppBindings>) {
  const params = posOrderParamsSchema.parse(c.req.param());

  try {
    const order = await getPosOrder({
      authContext: c.get("authContext"),
      orderId: params.orderId,
    });
    return c.json(order);
  } catch (error) {
    if (error instanceof PosOrderError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function createPosOrderController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createPosOrderBodySchema.parse(rawBody);

  try {
    const order = await createPosOrder({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data,
    });
    return c.json(order, 201);
  } catch (error) {
    if (error instanceof PosOrderError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function updatePosOrderController(c: Context<AppBindings>) {
  const params = posOrderParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updatePosOrderBodySchema.parse(rawBody);

  try {
    const order = await updatePosOrder(
      c.get("authContext"),
      params.orderId,
      data,
      getRequestMeta(c),
    );
    return c.json(order);
  } catch (error) {
    if (error instanceof PosOrderError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function changePosOrderStatusController(c: Context<AppBindings>) {
  const params = posOrderParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = changePosOrderStatusBodySchema.parse(rawBody);

  try {
    const order = await changePosOrderStatus(
      c.get("authContext"),
      params.orderId,
      data,
      getRequestMeta(c),
    );
    return c.json(order);
  } catch (error) {
    if (error instanceof PosOrderError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function deletePosOrderController(c: Context<AppBindings>) {
  const params = posOrderParamsSchema.parse(c.req.param());

  try {
    await deletePosOrder(
      c.get("authContext"),
      params.orderId,
      getRequestMeta(c),
    );
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof PosOrderError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function listPosOrderPaymentsController(c: Context<AppBindings>) {
  const params = posOrderParamsSchema.parse(c.req.param());

  try {
    const payments = await listPosOrderPayments(
      c.get("authContext"),
      params.orderId,
    );
    return c.json(payments);
  } catch (error) {
    if (error instanceof PosOrderError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function createPosOrderPaymentController(
  c: Context<AppBindings>,
) {
  const params = posOrderParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createPosPaymentBodySchema.parse(rawBody);

  try {
    const order = await createPosOrderPayment(
      c.get("authContext"),
      params.orderId,
      data,
      getRequestMeta(c),
    );
    return c.json(order, 201);
  } catch (error) {
    if (error instanceof PosOrderError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function createPosOrderItemController(c: Context<AppBindings>) {
  const params = posOrderParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createPosOrderItemBodySchema.parse(rawBody);

  try {
    const order = await createPosOrderItem(
      c.get("authContext"),
      params.orderId,
      data,
      getRequestMeta(c),
    );
    return c.json(order, 201);
  } catch (error) {
    if (error instanceof PosOrderError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function updatePosOrderItemController(c: Context<AppBindings>) {
  const params = posOrderItemParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updatePosOrderItemBodySchema.parse(rawBody);

  try {
    const order = await updatePosOrderItem(
      c.get("authContext"),
      params.orderId,
      params.itemId,
      data,
      getRequestMeta(c),
    );
    return c.json(order);
  } catch (error) {
    if (error instanceof PosOrderError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function deletePosOrderItemController(c: Context<AppBindings>) {
  const params = posOrderItemParamsSchema.parse(c.req.param());

  try {
    const order = await deletePosOrderItem(
      c.get("authContext"),
      params.orderId,
      params.itemId,
      getRequestMeta(c),
    );
    return c.json(order);
  } catch (error) {
    if (error instanceof PosOrderError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}
