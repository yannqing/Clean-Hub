import type { Context } from "hono";
import { z } from "zod";
import type { AppBindings } from "../../../http/types.js";
import type { AuthContext } from "../../auth/auth.types.js";
import { AuthError } from "../../auth/auth.errors.js";
import {
  getCustomerRefundSettlementPlan,
  settleCustomerRefund,
} from "../../pos/payment-adjustments/customer-refunds.service.js";

function owner(c: Context<AppBindings>): AuthContext {
  const auth = c.get("mobileAuthContext");
  if (auth.subjectType !== "staff" || auth.role !== "owner")
    throw new AuthError("FORBIDDEN", "Owner access is required.");
  return { ...auth, role: "owner", userId: auth.subjectId };
}
const params = z.object({ refundRequestId: z.string().length(26) });
export const refundSettlementBody = z
  .object({
    cashReturned: z.boolean(),
    providerReferences: z.record(
      z.string().length(26),
      z.string().trim().min(1).max(160),
    ),
  })
  .strict();
export async function getRefundSettlementController(c: Context<AppBindings>) {
  return c.json(
    await getCustomerRefundSettlementPlan(
      owner(c),
      params.parse(c.req.param()).refundRequestId,
    ),
  );
}
export async function settleRefundController(c: Context<AppBindings>) {
  return c.json(
    await settleCustomerRefund(
      owner(c),
      params.parse(c.req.param()).refundRequestId,
      refundSettlementBody.parse(await c.req.json()),
    ),
  );
}
