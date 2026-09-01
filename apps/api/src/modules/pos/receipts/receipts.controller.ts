import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { posOrderParamsSchema } from "../orders/orders.validation.js";
import { deliverPosOrderReceipt } from "./receipts.service.js";
import { deliverPosReceiptBodySchema } from "./receipts.validation.js";

export async function deliverPosOrderReceiptController(c: Context<AppBindings>) {
  const { orderId } = posOrderParamsSchema.parse(c.req.param());
  const data = deliverPosReceiptBodySchema.parse(await c.req.json());
  const result = await deliverPosOrderReceipt({
    authContext: c.get("authContext"),
    orderId,
    data,
  });
  return c.json(result, 201);
}
