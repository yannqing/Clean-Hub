import type { Context } from "hono";

import { logger } from "@cleanhub/logger";

import type { AppBindings } from "../../../http/types.js";
import {
  orderCreatedEvent,
  type NotificationPublisher,
} from "../../notifications/index.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { PosOrderError } from "./orders.errors.js";
import {
  changePosOrderStatus,
  confirmPosManualPayment,
  createPosOrder,
  createPosOrderItem,
  createPosOrderPayment,
  deletePosOrder,
  deletePosOrderItem,
  failPosManualPayment,
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
  deletePosOrderBodySchema,
  deletePosOrderItemBodySchema,
  failPosPaymentBodySchema,
  posOrderItemParamsSchema,
  posOrderListQuerySchema,
  posOrderOverviewQuerySchema,
  posOrderParamsSchema,
  posPaymentParamsSchema,
  resolvePosPaymentBodySchema,
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

export type CreatePosOrderControllerOptions = {
  notificationPublisher?: NotificationPublisher;
};

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

export function createPosOrderController({
  notificationPublisher,
}: CreatePosOrderControllerOptions = {}) {
  return async (c: Context<AppBindings>) => {
    const rawBody = await c.req.json().catch(() => ({}));
    const data = createPosOrderBodySchema.parse(rawBody);

    try {
      const order = await createPosOrder({
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        data,
      });
      const tenantId = c.get("authContext").tenantId;

      if (tenantId) {
        try {
          await notificationPublisher?.publish(
            orderCreatedEvent({
              tenantId,
              branchId: order.branchId,
              customerId: order.customerId,
              orderId: order.id,
              totalAmount: order.totalAmount,
            }),
          );
        } catch (publishError) {
          logger.error(
            { error: publishError, tenantId, orderId: order.id },
            "POS order notification event failed",
          );
        }
      }

      return c.json(order, 201);
    } catch (error) {
      if (error instanceof PosOrderError) {
        return createErrorResponse(c, error);
      }
      throw error;
    }
  };
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
  const rawBody = await c.req.json().catch(() => ({}));
  const data = deletePosOrderBodySchema.parse(rawBody);

  try {
    await deletePosOrder(
      c.get("authContext"),
      params.orderId,
      data,
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
    const result = await createPosOrderPayment(
      c.get("authContext"),
      params.orderId,
      data,
      getRequestMeta(c),
    );
    return c.json(result, result.idempotent ? 200 : 201);
  } catch (error) {
    if (error instanceof PosOrderError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function confirmPosManualPaymentController(
  c: Context<AppBindings>,
) {
  const params = posPaymentParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = resolvePosPaymentBodySchema.parse(rawBody);

  try {
    const order = await confirmPosManualPayment(
      c.get("authContext"),
      params.orderId,
      params.paymentId,
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

export async function failPosManualPaymentController(c: Context<AppBindings>) {
  const params = posPaymentParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = failPosPaymentBodySchema.parse(rawBody);

  try {
    const order = await failPosManualPayment(
      c.get("authContext"),
      params.orderId,
      params.paymentId,
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
  const rawBody = await c.req.json().catch(() => ({}));
  const data = deletePosOrderItemBodySchema.parse(rawBody);

  try {
    const order = await deletePosOrderItem(
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
