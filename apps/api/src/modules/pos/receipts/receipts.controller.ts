import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { posOrderParamsSchema } from "../orders/orders.validation.js";
import {
  deliverPosOrderReceipt,
  getPosOrderReceiptDeliveries,
  retryPosOrderReceiptDelivery,
} from "./receipts.service.js";
import {
  deliverPosReceiptBodySchema,
  posReceiptDeliveryParamsSchema,
} from "./receipts.validation.js";

export async function deliverPosOrderReceiptController(
  c: Context<AppBindings>,
) {
  const { orderId } = posOrderParamsSchema.parse(c.req.param());
  const data = deliverPosReceiptBodySchema.parse(await c.req.json());
  const result = await deliverPosOrderReceipt({
    authContext: c.get("authContext"),
    orderId,
    data,
  });
  return c.json(result, 201);
}

export async function listPosOrderReceiptDeliveriesController(
  c: Context<AppBindings>,
) {
  const { orderId } = posOrderParamsSchema.parse(c.req.param());
  return c.json(
    await getPosOrderReceiptDeliveries(c.get("authContext"), orderId),
  );
}

export async function retryPosOrderReceiptDeliveryController(
  c: Context<AppBindings>,
) {
  const { orderId, deliveryId } = posReceiptDeliveryParamsSchema.parse(
    c.req.param(),
  );
  return c.json(
    await retryPosOrderReceiptDelivery({
      authContext: c.get("authContext"),
      orderId,
      deliveryId,
    }),
  );
}
