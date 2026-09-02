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
  findAdjustmentById,
  findPaidPayment,
  insertPaymentAdjustment,
  listPaymentAdjustments,
  lockAdjustmentOrder,
  recalculateOrderAfterAdjustment,
  resolvePendingRefundAdjustment,
  completeSalesReturnWhenRefundsSettle,
  sumRefundedForPayment,
} from "./payment-adjustments.repository.js";
import type { PosAdjustmentOrder } from "./payment-adjustments.repository.js";
import type {
  CreatePosPaymentAdjustmentResponse,
  CreatePosPaymentCorrectionRequest,
  CreatePosRefundRequest,
  ResolvePosRefundRequest,
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

    const adjustmentStatus = refundData
      ? (refundData.settlementStatus ??
        (payment.paymentMethod === "cash" ? "succeeded" : "pending"))
      : "succeeded";
    if (
      refundData &&
      adjustmentStatus === "succeeded" &&
      payment.paymentMethod !== "cash" &&
      !refundData.settlementReference?.trim()
    ) {
      throw new PosOrderError(
        "VALIDATION_ERROR",
        "A non-cash refund can be completed only with the provider settlement reference.",
        422,
      );
    }

    if (refundData) {
      if (Number(refundData.amount) > Number(order.paidAmount)) {
        throw new PosOrderError(
          "PAYMENT_AMOUNT_EXCEEDED",
          "Refund amount exceeds the order's current paid amount.",
          409,
        );
      }
      const alreadyRefunded = await sumRefundedForPayment(tx, {
        tenantId,
        paymentId: payment.id,
      });
      if (
        alreadyRefunded + Number(refundData.amount) >
        Number(payment.amount)
      ) {
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
      status: adjustmentStatus,
      salesReturnId: refundData?.salesReturnId,
      amount: input.data.amount,
      currency: order.currency,
      idempotencyKey: input.data.idempotencyKey,
      reason,
      settlementReference: refundData?.settlementReference?.trim(),
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

    const balance =
      adjustment.status === "succeeded"
        ? await recalculateOrderAfterAdjustment(tx, {
            tenantId,
            order,
            actorUserId: input.authContext.userId,
          })
        : { paidAmount: order.paidAmount, paymentStatus: order.paymentStatus };
    if (created) {
      await writeAuditLog(tx, {
        tenantId,
        branchId: order.branchId,
        actorUserId: input.authContext.userId,
        eventCategory: "pos_order",
        eventType:
          kind === "refund"
            ? adjustment.status === "succeeded"
              ? "pos.order.payment_refunded"
              : "pos.order.refund_pending"
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

export async function resolvePosRefund(
  adjustmentId: string,
  input: PosPaymentAdjustmentMutationInput<ResolvePosRefundRequest>,
  db: Database = getDb(),
): Promise<CreatePosPaymentAdjustmentResponse> {
  const tenantId = requirePosTenantId(input.authContext);
  const reason = authorizePosSensitiveOperation(
    input.authContext,
    "refund",
    input.data.reason,
  );
  return db.transaction(async (tx) => {
    const adjustment = await findAdjustmentById(tx, { tenantId, adjustmentId });
    if (!adjustment || adjustment.adjustmentType !== "refund") {
      throw new PosOrderError(
        "PAYMENT_NOT_FOUND",
        "Refund was not found.",
        404,
      );
    }
    const order = await lockAdjustmentOrder(tx, {
      tenantId,
      orderId: adjustment.orderId,
    });
    if (!order) {
      throw new PosOrderError("ORDER_NOT_FOUND", "Order not found.", 404);
    }
    requirePosBranchAccess(input.authContext, order.branchId);
    if (
      adjustment.status === "succeeded" ||
      (adjustment.status === "failed" && input.data.outcome === "failed")
    ) {
      return {
        adjustment,
        idempotent: true,
        paidAmount: order.paidAmount,
        paymentStatus: order.paymentStatus,
      };
    }
    const payment = adjustment.originalPaymentId
      ? await findPaidPayment(tx, {
          tenantId,
          orderId: order.id,
          paymentId: adjustment.originalPaymentId,
        })
      : null;
    if (!payment) {
      throw new PosOrderError(
        "PAYMENT_NOT_FOUND",
        "The original payment is not available.",
        404,
      );
    }
    if (adjustment.status === "failed" && input.data.outcome === "succeeded") {
      const alreadyRefunded = await sumRefundedForPayment(tx, {
        tenantId,
        paymentId: payment.id,
      });
      if (
        alreadyRefunded + Number(adjustment.amount) >
        Number(payment.amount)
      ) {
        throw new PosOrderError(
          "PAYMENT_AMOUNT_EXCEEDED",
          "This failed refund can no longer be completed because the payment's refundable balance was used by another refund.",
          409,
        );
      }
    }
    if (
      input.data.outcome === "succeeded" &&
      payment.paymentMethod !== "cash" &&
      !input.data.settlementReference?.trim()
    ) {
      throw new PosOrderError(
        "VALIDATION_ERROR",
        "A provider settlement reference is required for a non-cash refund.",
        422,
      );
    }
    const resolved = await resolvePendingRefundAdjustment(tx, {
      tenantId,
      adjustmentId,
      outcome: input.data.outcome,
      settlementReference: input.data.settlementReference?.trim(),
      failureReason: input.data.outcome === "failed" ? reason : undefined,
      actorUserId: input.authContext.userId,
    });
    if (!resolved) {
      throw new PosOrderError(
        "VERSION_CONFLICT",
        "Refund status changed; refresh and try again.",
        409,
      );
    }
    const balance =
      resolved.status === "succeeded"
        ? await recalculateOrderAfterAdjustment(tx, {
            tenantId,
            order,
            actorUserId: input.authContext.userId,
          })
        : { paidAmount: order.paidAmount, paymentStatus: order.paymentStatus };
    if (resolved.salesReturnId && resolved.status === "succeeded") {
      await completeSalesReturnWhenRefundsSettle(tx, {
        tenantId,
        salesReturnId: resolved.salesReturnId,
        actorUserId: input.authContext.userId,
      });
    }
    await writeAuditLog(tx, {
      tenantId,
      branchId: order.branchId,
      actorUserId: input.authContext.userId,
      eventCategory: "pos_order",
      eventType: `pos.order.refund_${resolved.status}`,
      entityType: "pos_payment_adjustment",
      entityId: resolved.id,
      reason,
      before: adjustment,
      after: resolved,
      metadata: createPosAuditMetadata(input.authContext, {
        orderId: order.id,
        originalPaymentId: resolved.originalPaymentId,
      }),
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    return { adjustment: resolved, idempotent: false, ...balance };
  });
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
