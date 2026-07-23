import { getDb, type Database } from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import {
  authorizePosSensitiveOperation,
  createPosAuditMetadata,
  requirePosBranchAccess,
  requirePosTenantId,
} from "../access-control.helper.js";
import { PosOrderError } from "../orders/orders.errors.js";
import {
  findAdjustmentByIdempotencyKey,
  findPaidPayment,
  insertPaymentAdjustment,
  listPaymentAdjustments,
  lockAdjustmentOrder,
  recalculateOrderAfterAdjustment,
  sumRefundedForPayment,
} from "./payment-adjustments.repository.js";
import type { PosAdjustmentOrder } from "./payment-adjustments.repository.js";
import type {
  CreatePosPaymentAdjustmentResponse,
  CreatePosPaymentCorrectionRequest,
  CreatePosRefundRequest,
  PosPaymentAdjustment,
  PosPaymentAdjustmentMutationInput,
} from "./payment-adjustments.types.js";

function assertIdempotentMatch(
  existing: PosPaymentAdjustment,
  expected: {
    orderId: string;
    adjustmentType: "refund" | "correction";
    direction: "debit" | "credit";
    amount: string;
    originalPaymentId?: string;
    reason: string;
  },
): void {
  if (
    existing.orderId !== expected.orderId ||
    existing.adjustmentType !== expected.adjustmentType ||
    existing.direction !== expected.direction ||
    Number(existing.amount) !== Number(expected.amount) ||
    existing.originalPaymentId !== (expected.originalPaymentId ?? null) ||
    existing.reason !== expected.reason
  ) {
    throw new PosOrderError(
      "PAYMENT_REFERENCE_CONFLICT",
      "The idempotency key is already used by another adjustment.",
      409,
    );
  }
}

export function buildIdempotentAdjustmentResponse(
  adjustment: PosPaymentAdjustment,
  order: PosAdjustmentOrder,
): CreatePosPaymentAdjustmentResponse {
  return {
    adjustment,
    idempotent: true,
    paidAmount: order.paidAmount,
    paymentStatus: order.paymentStatus,
  };
}

async function createAdjustment(
  input: PosPaymentAdjustmentMutationInput<
    CreatePosRefundRequest | CreatePosPaymentCorrectionRequest
  >,
  kind: "refund" | "correction",
  db: Database,
): Promise<CreatePosPaymentAdjustmentResponse> {
  const tenantId = requirePosTenantId(input.authContext);
  const direction =
    kind === "refund"
      ? "debit"
      : (input.data as CreatePosPaymentCorrectionRequest).direction;
  const reason = authorizePosSensitiveOperation(
    input.authContext,
    kind === "refund" ? "refund" : "payment_correction",
    input.data.reason,
  );

  return db.transaction(async (tx) => {
    const order = await lockAdjustmentOrder(tx, {
      tenantId,
      orderId: input.data.orderId,
    });
    if (!order) {
      throw new PosOrderError("ORDER_NOT_FOUND", "Order not found.", 404);
    }
    requirePosBranchAccess(input.authContext, order.branchId);

    const refundData =
      kind === "refund" ? (input.data as CreatePosRefundRequest) : null;
    const expected = {
      orderId: input.data.orderId,
      adjustmentType: kind,
      direction,
      amount: input.data.amount,
      originalPaymentId: input.data.originalPaymentId,
      reason,
    } as const;
    const existing = await findAdjustmentByIdempotencyKey(tx, {
      tenantId,
      idempotencyKey: input.data.idempotencyKey,
    });
    if (existing) {
      assertIdempotentMatch(existing, expected);
      return buildIdempotentAdjustmentResponse(existing, order);
    }

    const payment = await findPaidPayment(tx, {
      tenantId,
      orderId: order.id,
      paymentId: input.data.originalPaymentId,
    });
    if (!payment || payment.currency !== order.currency) {
      throw new PosOrderError(
        "PAYMENT_NOT_FOUND",
        "The original paid transaction is not available for adjustment.",
        404,
      );
    }

    if (refundData) {
      const alreadyRefunded = await sumRefundedForPayment(tx, {
        tenantId,
        paymentId: payment.id,
      });
      if (alreadyRefunded + Number(refundData.amount) > Number(payment.amount)) {
        throw new PosOrderError(
          "PAYMENT_AMOUNT_EXCEEDED",
          "Refund amount exceeds the remaining refundable amount.",
          409,
        );
      }
    } else {
      const currentPaid = Number(order.paidAmount);
      const nextPaid =
        direction === "debit"
          ? currentPaid - Number(input.data.amount)
          : currentPaid + Number(input.data.amount);
      if (nextPaid < 0 || nextPaid > Number(order.totalAmount)) {
        throw new PosOrderError(
          "PAYMENT_AMOUNT_EXCEEDED",
          "Correction would move the paid amount outside the order balance.",
          409,
        );
      }
    }

    const created = await insertPaymentAdjustment(tx, {
      tenantId,
      branchId: order.branchId,
      customerId: order.customerId,
      orderId: order.id,
      originalPaymentId: input.data.originalPaymentId,
      adjustmentType: kind,
      direction,
      amount: input.data.amount,
      currency: order.currency,
      idempotencyKey: input.data.idempotencyKey,
      reason,
      actorUserId: input.authContext.userId,
    });
    const adjustment =
      created ??
      (await findAdjustmentByIdempotencyKey(tx, {
        tenantId,
        idempotencyKey: input.data.idempotencyKey,
      }));
    if (!adjustment) {
      throw new PosOrderError(
        "PAYMENT_REFERENCE_CONFLICT",
        "Payment adjustment could not be created.",
        409,
      );
    }
    if (!created) {
      assertIdempotentMatch(adjustment, expected);
    }

    const balance = await recalculateOrderAfterAdjustment(tx, {
      tenantId,
      order,
      actorUserId: input.authContext.userId,
    });
    if (created) {
      await writeAuditLog(tx, {
        tenantId,
        branchId: order.branchId,
        actorUserId: input.authContext.userId,
        eventCategory: "pos_order",
        eventType:
          kind === "refund"
            ? "pos.order.payment_refunded"
            : "pos.order.payment_corrected",
        entityType: "pos_payment_adjustment",
        entityId: adjustment.id,
        reason,
        before: {
          paidAmount: order.paidAmount,
          paymentStatus: order.paymentStatus,
          status: order.status,
        },
        after: {
          ...adjustment,
          paidAmount: balance.paidAmount,
          paymentStatus: balance.paymentStatus,
        },
        metadata: createPosAuditMetadata(input.authContext, {
          orderId: order.id,
          originalPaymentId: input.data.originalPaymentId,
          direction,
        }),
        ipAddress: input.requestMeta?.ipAddress,
        userAgent: input.requestMeta?.userAgent,
      });
    }

    return { adjustment, idempotent: !created, ...balance };
  });
}

export function createPosRefund(
  input: PosPaymentAdjustmentMutationInput<CreatePosRefundRequest>,
  db: Database = getDb(),
) {
  return createAdjustment(input, "refund", db);
}

export function createPosPaymentCorrection(
  input: PosPaymentAdjustmentMutationInput<CreatePosPaymentCorrectionRequest>,
  db: Database = getDb(),
) {
  return createAdjustment(input, "correction", db);
}

export async function getPosPaymentAdjustments(
  authContext: PosPaymentAdjustmentMutationInput<never>["authContext"],
  orderId: string,
  db: Database = getDb(),
) {
  const tenantId = requirePosTenantId(authContext);
  const order = await lockAdjustmentOrder(db, { tenantId, orderId });
  if (!order) {
    throw new PosOrderError("ORDER_NOT_FOUND", "Order not found.", 404);
  }
  requirePosBranchAccess(authContext, order.branchId);
  return { data: await listPaymentAdjustments(db, { tenantId, orderId }) };
}
