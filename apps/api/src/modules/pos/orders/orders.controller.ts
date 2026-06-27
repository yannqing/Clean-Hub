import type { Context } from "hono";

import { logger } from "@cleanhub/logger";

import type { AppBindings } from "../../../http/types.js";
import {
  orderCreatedEvent,
  type NotificationPublisher,
} from "../../notifications/index.js";
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

export type CreatePosOrderControllerOptions = {
  notificationPublisher?: NotificationPublisher;
};

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

export function createPosOrderController({
  notificationPublisher,
}: CreatePosOrderControllerOptions = {}) {
  return async (c: Context<AppBindings>) => {
    const rawBody = await c.req.json().catch(() => ({}));
    const data = rawBody as CreatePosOrderRequest;

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
              orderNo: order.orderNumber,
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
      if (error instanceof PosNotImplementedError) {
        return notImplementedResponse(c, error);
      }
      throw error;
    }
  };
}
