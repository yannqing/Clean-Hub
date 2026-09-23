import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { PosOrderError } from "../orders/orders.errors.js";
import {
  applyPosOrderDiscount,
  removePosOrderDiscount,
} from "./discounts.service.js";
import {
  applyPosOrderDiscountBodySchema,
  posOrderDiscountApplicationParamsSchema,
  posOrderDiscountParamsSchema,
  removePosOrderDiscountBodySchema,
} from "./discounts.validation.js";
import { localizeErrorMessage } from "../../../http/error-messages.js";

function createErrorResponse(c: Context<AppBindings>, error: PosOrderError) {
  return c.json(
    {
      message: localizeErrorMessage(error.message, c.get("locale")),
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function applyPosOrderDiscountController(c: Context<AppBindings>) {
  const params = posOrderDiscountParamsSchema.parse(c.req.param());
  const data = applyPosOrderDiscountBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );

  try {
    const order = await applyPosOrderDiscount({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      orderId: params.orderId,
      data,
    });
    return c.json(order);
  } catch (error) {
    if (error instanceof PosOrderError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function removePosOrderDiscountController(
  c: Context<AppBindings>,
) {
  const params = posOrderDiscountApplicationParamsSchema.parse(c.req.param());
  const data = removePosOrderDiscountBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );

  try {
    const order = await removePosOrderDiscount({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      orderId: params.orderId,
      applicationId: params.applicationId,
      data,
    });
    return c.json(order);
  } catch (error) {
    if (error instanceof PosOrderError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}
