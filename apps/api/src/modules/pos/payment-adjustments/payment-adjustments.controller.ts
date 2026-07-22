import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getRequestMeta } from "../request-meta.helper.js";
import {
  createPosPaymentCorrection,
  createPosRefund,
  getPosPaymentAdjustments,
} from "./payment-adjustments.service.js";
import {
  createPosPaymentCorrectionBodySchema,
  createPosRefundBodySchema,
  listPosPaymentAdjustmentsQuerySchema,
} from "./payment-adjustments.validation.js";

export async function listPaymentAdjustmentsController(
  c: Context<AppBindings>,
) {
  const query = listPosPaymentAdjustmentsQuerySchema.parse(c.req.query());
  return c.json(
    await getPosPaymentAdjustments(c.get("authContext"), query.orderId),
  );
}

export async function createRefundController(c: Context<AppBindings>) {
  const data = createPosRefundBodySchema.parse(await c.req.json());
  const result = await createPosRefund({
    authContext: c.get("authContext"),
    requestMeta: getRequestMeta(c),
    data,
  });
  return c.json(result, result.idempotent ? 200 : 201);
}

export async function createPaymentCorrectionController(
  c: Context<AppBindings>,
) {
  const data = createPosPaymentCorrectionBodySchema.parse(await c.req.json());
  const result = await createPosPaymentCorrection({
    authContext: c.get("authContext"),
    requestMeta: getRequestMeta(c),
    data,
  });
  return c.json(result, result.idempotent ? 200 : 201);
}
