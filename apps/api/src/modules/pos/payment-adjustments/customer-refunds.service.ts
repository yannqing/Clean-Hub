import {
  getDb,
  paymentTransactions,
  refundRequests,
  type Database,
} from "@cleanhub/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { amountToCents, centsToAmount } from "@cleanhub/domain/money";
import { getCurrencyPayableStep } from "@cleanhub/domain/currency";
import type { AuthContext } from "../../auth/auth.types.js";
import {
  requirePosBranchAccess,
  requirePosRole,
  requirePosTenantId,
} from "../access-control.helper.js";
import { PosOrderError } from "../orders/orders.errors.js";
import {
  lockAdjustmentOrder,
  sumRefundedForPayment,
} from "./payment-adjustments.repository.js";
import { createPosRefund } from "./payment-adjustments.service.js";

export type RefundSettlementInput = {
  cashReturned: boolean;
  providerReferences: Record<string, string>;
};
export type RefundSettlementAllocation = {
  paymentId: string;
  paymentMethod: string;
  amount: string;
  currency: string;
};

function invalid(message: string): never {
  throw new PosOrderError("VALIDATION_ERROR", message, 422);
}

export async function getCustomerRefundSettlementPlan(
  auth: AuthContext,
  requestId: string,
  db: Database = getDb(),
) {
  const tenantId = requirePosTenantId(auth);
  requirePosRole(auth, ["owner", "manager"]);
  const [request] = await db
    .select()
    .from(refundRequests)
    .where(
      and(
        eq(refundRequests.id, requestId),
        eq(refundRequests.tenantId, tenantId),
        isNull(refundRequests.deletedAt),
      ),
    )
    .limit(1);
  if (!request)
    throw new PosOrderError(
      "ORDER_NOT_FOUND",
      "Refund request was not found.",
      404,
    );
  requirePosBranchAccess(auth, request.branchId);
  const payments = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.tenantId, tenantId),
        eq(paymentTransactions.orderId, request.orderId),
        eq(paymentTransactions.paymentStatus, "paid"),
        isNull(paymentTransactions.deletedAt),
      ),
    )
    .orderBy(asc(paymentTransactions.createdAt), asc(paymentTransactions.id));
  let remaining = amountToCents(request.amount);
  const allocations: RefundSettlementAllocation[] = [];
  for (const payment of payments) {
    if (remaining <= BigInt(0)) break;
    const refunded = amountToCents(
      await sumRefundedForPayment(db, { tenantId, paymentId: payment.id }),
    );
    const available = amountToCents(payment.amount) - refunded;
    if (available <= BigInt(0) || payment.currency !== request.currency)
      continue;
    const amount = available < remaining ? available : remaining;
    if (amount % getCurrencyPayableStep(request.currency) !== BigInt(0))
      invalid("Refund amount cannot be settled in this currency.");
    allocations.push({
      paymentId: payment.id,
      paymentMethod: payment.paymentMethod,
      amount: centsToAmount(amount),
      currency: payment.currency,
    });
    remaining -= amount;
  }
  return {
    requestId,
    orderId: request.orderId,
    status: request.status,
    amount: request.amount,
    currency: request.currency,
    allocations,
    canSettle: request.status === "approved" && remaining === BigInt(0),
  };
}

/** One transaction, the POS ledger, and deterministic per-payment keys. No gateway simulation. */
export async function settleCustomerRefund(
  auth: AuthContext,
  requestId: string,
  input: RefundSettlementInput,
  db: Database = getDb(),
) {
  const tenantId = requirePosTenantId(auth);
  requirePosRole(auth, ["owner", "manager"]);
  return db.transaction(async (tx) => {
    const [initial] = await tx
      .select({ orderId: refundRequests.orderId })
      .from(refundRequests)
      .where(
        and(
          eq(refundRequests.tenantId, tenantId),
          eq(refundRequests.id, requestId),
          isNull(refundRequests.deletedAt),
        ),
      )
      .limit(1);
    if (!initial)
      throw new PosOrderError(
        "ORDER_NOT_FOUND",
        "Refund request was not found.",
        404,
      );
    const order = await lockAdjustmentOrder(tx, {
      tenantId,
      orderId: initial.orderId,
    });
    if (!order)
      throw new PosOrderError("ORDER_NOT_FOUND", "Order not found.", 404);
    requirePosBranchAccess(auth, order.branchId);
    const [request] = await tx
      .select()
      .from(refundRequests)
      .where(
        and(
          eq(refundRequests.tenantId, tenantId),
          eq(refundRequests.id, requestId),
          isNull(refundRequests.deletedAt),
        ),
      )
      .for("update")
      .limit(1);
    if (
      !request ||
      request.branchId !== order.branchId ||
      request.currency !== order.currency ||
      request.customerId !== order.customerId
    )
      invalid("Refund request no longer matches its order.");
    if (request.status === "refunded")
      return { requestId, status: "refunded" as const, idempotent: true };
    if (request.status !== "approved")
      invalid("Approve this refund before recording its settlement.");
    if (amountToCents(request.amount) > amountToCents(order.paidAmount))
      invalid("Refund amount exceeds the order's current paid amount.");
    const plan = await getCustomerRefundSettlementPlan(auth, requestId, tx);
    if (!plan.canSettle)
      invalid("The refundable balance changed. Review the original payments.");
    // Validate the entire plan before recording any money movement.
    for (const allocation of plan.allocations) {
      if (allocation.paymentMethod === "cash" && !input.cashReturned)
        invalid(
          "Confirm that the cash has actually been returned to the customer.",
        );
      if (
        allocation.paymentMethod !== "cash" &&
        !input.providerReferences[allocation.paymentId]?.trim()
      )
        invalid(
          "A provider settlement reference is required for every non-cash refund.",
        );
    }
    for (const allocation of plan.allocations) {
      await createPosRefund(
        {
          authContext: auth,
          data: {
            orderId: order.id,
            originalPaymentId: allocation.paymentId,
            amount: allocation.amount,
            reason: request.reason.slice(0, 500),
            customerRefundRequestId: requestId,
            idempotencyKey: `customer-refund:${requestId}:${allocation.paymentId}`,
            settlementStatus: "succeeded",
            settlementReference:
              input.providerReferences[allocation.paymentId]?.trim(),
          },
        },
        tx,
      );
    }
    await tx
      .update(refundRequests)
      .set({
        status: "refunded",
        refundedAt: new Date(),
        gateway: "pos",
        externalId: `pos-refund:${requestId}`,
        updatedAt: new Date(),
        version: sql`${refundRequests.version} + 1`,
      })
      .where(
        and(
          eq(refundRequests.tenantId, tenantId),
          eq(refundRequests.id, requestId),
          eq(refundRequests.status, "approved"),
        ),
      );
    return { requestId, status: "refunded" as const, idempotent: false };
  });
}
