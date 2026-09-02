import {
  orders,
  paymentTransactions,
  posPaymentAdjustments,
  salesReturns,
  type Database,
} from "@cleanhub/db";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { createId } from "@cleanhub/id";

import type {
  PosPaymentAdjustment,
  PosPaymentAdjustmentDirection,
  PosPaymentAdjustmentType,
} from "./payment-adjustments.types.js";
import { projectPosOrderPaymentState } from "../orders/order-payment-state.js";

export type PosAdjustmentOrder = {
  id: string;
  branchId: string;
  customerId: string | null;
  currency: string;
  totalAmount: string;
  paidAmount: string;
  paymentStatus: "unpaid" | "partial" | "paid" | "refunded";
  status: "draft" | "received" | "paid" | "delivered" | "cancelled";
};

function toAdjustment(
  row: typeof posPaymentAdjustments.$inferSelect,
): PosPaymentAdjustment {
  return {
    id: row.id,
    orderId: row.orderId,
    originalPaymentId: row.originalPaymentId,
    adjustmentType: row.adjustmentType,
    direction: row.direction,
    status: row.status,
    salesReturnId: row.salesReturnId,
    amount: row.amount,
    currency: row.currency,
    idempotencyKey: row.idempotencyKey,
    reason: row.reason,
    settlementReference: row.settlementReference,
    failureReason: row.failureReason,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
  };
}

export async function lockAdjustmentOrder(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<PosAdjustmentOrder | null> {
  const rows = await db
    .select({
      id: orders.id,
      branchId: orders.branchId,
      customerId: orders.customerId,
      currency: orders.currency,
      totalAmount: orders.totalAmount,
      paidAmount: orders.paidAmount,
      paymentStatus: orders.paymentStatus,
      status: orders.status,
    })
    .from(orders)
    .where(
      and(
        eq(orders.id, input.orderId),
        eq(orders.tenantId, input.tenantId),
        isNull(orders.deletedAt),
      ),
    )
    .for("update")
    .limit(1);
  return rows[0] ?? null;
}

export async function findPaidPayment(
  db: Database,
  input: { tenantId: string; orderId: string; paymentId: string },
) {
  const rows = await db
    .select({
      id: paymentTransactions.id,
      amount: paymentTransactions.amount,
      currency: paymentTransactions.currency,
      paymentMethod: paymentTransactions.paymentMethod,
      gateway: paymentTransactions.gateway,
    })
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.id, input.paymentId),
        eq(paymentTransactions.tenantId, input.tenantId),
        eq(paymentTransactions.orderId, input.orderId),
        eq(paymentTransactions.paymentStatus, "paid"),
        isNull(paymentTransactions.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function findAdjustmentByIdempotencyKey(
  db: Database,
  input: { tenantId: string; idempotencyKey: string },
): Promise<PosPaymentAdjustment | null> {
  const rows = await db
    .select()
    .from(posPaymentAdjustments)
    .where(
      and(
        eq(posPaymentAdjustments.tenantId, input.tenantId),
        eq(posPaymentAdjustments.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  return rows[0] ? toAdjustment(rows[0]) : null;
}

export async function findAdjustmentById(
  db: Database,
  input: { tenantId: string; adjustmentId: string },
): Promise<PosPaymentAdjustment | null> {
  const [row] = await db
    .select()
    .from(posPaymentAdjustments)
    .where(
      and(
        eq(posPaymentAdjustments.tenantId, input.tenantId),
        eq(posPaymentAdjustments.id, input.adjustmentId),
      ),
    )
    .limit(1);
  return row ? toAdjustment(row) : null;
}

export async function sumRefundedForPayment(
  db: Database,
  input: { tenantId: string; paymentId: string },
): Promise<number> {
  const rows = await db
    .select({
      total: sql<string>`coalesce(sum(${posPaymentAdjustments.amount}), 0)`,
    })
    .from(posPaymentAdjustments)
    .where(
      and(
        eq(posPaymentAdjustments.tenantId, input.tenantId),
        eq(posPaymentAdjustments.originalPaymentId, input.paymentId),
        eq(posPaymentAdjustments.adjustmentType, "refund"),
        eq(posPaymentAdjustments.direction, "debit"),
        inArray(posPaymentAdjustments.status, ["pending", "succeeded"]),
      ),
    );
  return Number(rows[0]?.total ?? "0");
}

export async function insertPaymentAdjustment(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    customerId: string | null;
    orderId: string;
    originalPaymentId?: string;
    adjustmentType: PosPaymentAdjustmentType;
    direction: PosPaymentAdjustmentDirection;
    status?: "pending" | "succeeded";
    salesReturnId?: string;
    amount: string;
    currency: string;
    idempotencyKey: string;
    reason: string;
    settlementReference?: string;
    actorUserId: string;
  },
): Promise<PosPaymentAdjustment | null> {
  const rows = await db
    .insert(posPaymentAdjustments)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      branchId: input.branchId,
      customerId: input.customerId,
      orderId: input.orderId,
      originalPaymentId: input.originalPaymentId,
      adjustmentType: input.adjustmentType,
      direction: input.direction,
      status: input.status ?? "succeeded",
      salesReturnId: input.salesReturnId,
      amount: Number(input.amount).toFixed(2),
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
      settlementReference: input.settlementReference,
      resolvedAt: input.status === "pending" ? null : new Date(),
      resolvedBy: input.status === "pending" ? null : input.actorUserId,
      createdBy: input.actorUserId,
    })
    .onConflictDoNothing()
    .returning();
  return rows[0] ? toAdjustment(rows[0]) : null;
}

export async function listPaymentAdjustments(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<PosPaymentAdjustment[]> {
  const rows = await db
    .select()
    .from(posPaymentAdjustments)
    .where(
      and(
        eq(posPaymentAdjustments.tenantId, input.tenantId),
        eq(posPaymentAdjustments.orderId, input.orderId),
      ),
    )
    .orderBy(asc(posPaymentAdjustments.occurredAt));
  return rows.map(toAdjustment);
}

export async function resolvePendingRefundAdjustment(
  db: Database,
  input: {
    tenantId: string;
    adjustmentId: string;
    outcome: "succeeded" | "failed";
    settlementReference?: string;
    failureReason?: string;
    actorUserId: string;
  },
): Promise<PosPaymentAdjustment | null> {
  const [row] = await db
    .update(posPaymentAdjustments)
    .set({
      status: input.outcome,
      settlementReference: input.settlementReference,
      failureReason: input.outcome === "failed" ? input.failureReason : null,
      resolvedAt: new Date(),
      resolvedBy: input.actorUserId,
    })
    .where(
      and(
        eq(posPaymentAdjustments.tenantId, input.tenantId),
        eq(posPaymentAdjustments.id, input.adjustmentId),
        eq(posPaymentAdjustments.adjustmentType, "refund"),
        inArray(posPaymentAdjustments.status, ["pending", "failed"]),
      ),
    )
    .returning();
  return row ? toAdjustment(row) : null;
}

export async function completeSalesReturnWhenRefundsSettle(
  db: Database,
  input: { tenantId: string; salesReturnId: string; actorUserId: string },
): Promise<boolean> {
  const [unsettled] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posPaymentAdjustments)
    .where(
      and(
        eq(posPaymentAdjustments.tenantId, input.tenantId),
        eq(posPaymentAdjustments.salesReturnId, input.salesReturnId),
        eq(posPaymentAdjustments.adjustmentType, "refund"),
        inArray(posPaymentAdjustments.status, ["pending", "failed"]),
      ),
    );
  if (Number(unsettled?.count ?? 0) > 0) return false;
  const rows = await db
    .update(salesReturns)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${salesReturns.version} + 1`,
    })
    .where(
      and(
        eq(salesReturns.tenantId, input.tenantId),
        eq(salesReturns.id, input.salesReturnId),
        inArray(salesReturns.status, ["approved", "received"]),
      ),
    )
    .returning({ id: salesReturns.id });
  return rows.length > 0;
}

export async function recalculateOrderAfterAdjustment(
  db: Database,
  input: {
    tenantId: string;
    order: PosAdjustmentOrder;
    actorUserId: string;
  },
): Promise<{
  paidAmount: string;
  paymentStatus: "unpaid" | "partial" | "paid" | "refunded";
}> {
  const paymentRows = await db
    .select({
      total: sql<string>`coalesce(sum(${paymentTransactions.amount}), 0)`,
    })
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.tenantId, input.tenantId),
        eq(paymentTransactions.orderId, input.order.id),
        eq(paymentTransactions.paymentStatus, "paid"),
        isNull(paymentTransactions.deletedAt),
      ),
    );
  const adjustmentRows = await db
    .select({
      debit: sql<string>`coalesce(sum(${posPaymentAdjustments.amount}) filter (where ${posPaymentAdjustments.direction} = 'debit'), 0)`,
      credit: sql<string>`coalesce(sum(${posPaymentAdjustments.amount}) filter (where ${posPaymentAdjustments.direction} = 'credit'), 0)`,
    })
    .from(posPaymentAdjustments)
    .where(
      and(
        eq(posPaymentAdjustments.tenantId, input.tenantId),
        eq(posPaymentAdjustments.orderId, input.order.id),
        eq(posPaymentAdjustments.status, "succeeded"),
      ),
    );

  const grossPaid = Number(paymentRows[0]?.total ?? "0");
  const debit = Number(adjustmentRows[0]?.debit ?? "0");
  const credit = Number(adjustmentRows[0]?.credit ?? "0");
  const paid = Math.max(0, grossPaid - debit + credit);
  const projected = projectPosOrderPaymentState({
    current: {
      ...input.order,
      paidAt: null,
    },
    nextTotalAmount: input.order.totalAmount,
    nextPaidAmount: paid.toFixed(2),
  });
  const paymentStatus =
    paid <= 0 && grossPaid > 0 ? "refunded" : projected.paymentStatus;
  const nextOrderStatus =
    paymentStatus === "refunded" && input.order.status === "paid"
      ? "received"
      : projected.status;

  await db
    .update(orders)
    .set({
      paidAmount: paid.toFixed(2),
      paymentStatus,
      paidAt: paymentStatus === "paid" ? projected.paidAt : null,
      status: nextOrderStatus,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${orders.version} + 1`,
    })
    .where(
      and(
        eq(orders.id, input.order.id),
        eq(orders.tenantId, input.tenantId),
        isNull(orders.deletedAt),
      ),
    );

  return { paidAmount: paid.toFixed(2), paymentStatus };
}
