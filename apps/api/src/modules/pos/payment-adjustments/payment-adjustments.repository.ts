import {
  orders,
  paymentTransactions,
  posPaymentAdjustments,
  type Database,
} from "@cleanhub/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
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
    amount: row.amount,
    currency: row.currency,
    idempotencyKey: row.idempotencyKey,
    reason: row.reason,
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
    amount: string;
    currency: string;
    idempotencyKey: string;
    reason: string;
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
      amount: Number(input.amount).toFixed(2),
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
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

export async function recalculateOrderAfterAdjustment(
  db: Database,
  input: {
    tenantId: string;
    order: PosAdjustmentOrder;
    actorUserId: string;
  },
): Promise<{ paidAmount: string; paymentStatus: "unpaid" | "partial" | "paid" | "refunded" }> {
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
