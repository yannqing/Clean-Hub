import { createId } from "@cleanhub/id";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  ne,
  sql,
} from "drizzle-orm";

import {
  customers,
  orderItems,
  orders,
  paymentCallbacks,
  paymentTransactions,
  refundRequests,
  type Database,
} from "@cleanhub/db";

import {
  addAmounts,
  amountToCents,
  centsToAmount,
  compareAmounts,
  subtractAmounts,
} from "./payment-money.js";
import type {
  CustomerPaymentTransaction,
  OrderPaymentStatus,
  PaymentGatewayCallbackVerification,
  PaymentGatewayName,
  PaymentTransactionStatus,
  RefundOrderDetail,
  RefundRequest,
  RefundRequestStatus,
} from "./payment.types.js";
import { findPosOrderFulfilmentState } from "../../pos/orders/orders.repository.js";

export type PaymentOrderRecord = {
  id: string;
  tenantId: string;
  branchId: string;
  currency: string;
  customerId: string;
  customerAccountId: string;
  status: "draft" | "received" | "paid" | "delivered" | "cancelled";
  paymentStatus: OrderPaymentStatus;
  totalAmount: string;
  paidAmount: string;
  paidAt: Date | null;
  version: number;
};

export type PaymentCallbackRecord = {
  id: string;
  tenantId: string | null;
  gateway: string;
  externalId: string;
  event: string;
  signatureVerified: boolean;
  processingStatus: "received" | "processed" | "rejected" | "failed";
  failureReason: string | null;
  processedAt: Date | null;
};

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toTransaction(
  row: typeof paymentTransactions.$inferSelect,
): CustomerPaymentTransaction {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    customerId: row.customerId,
    orderId: row.orderId,
    amount: row.amount,
    currency: row.currency,
    paymentStatus: row.paymentStatus,
    idempotencyKey: row.idempotencyKey,
    gateway: row.gateway,
    externalId: row.externalId,
    paidAt: toIsoString(row.paidAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRefundRequest(
  row: typeof refundRequests.$inferSelect,
): RefundRequest {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    customerAccountId: row.customerAccountId,
    customerId: row.customerId,
    orderId: row.orderId,
    paymentTransactionId: row.paymentTransactionId,
    amount: row.amount,
    currency: row.currency,
    reason: row.reason,
    status: row.status,
    gateway: row.gateway,
    externalId: row.externalId,
    approvedAt: toIsoString(row.approvedAt),
    approvedBy: row.approvedBy,
    rejectedAt: toIsoString(row.rejectedAt),
    rejectedBy: row.rejectedBy,
    rejectionReason: row.rejectionReason,
    refundedAt: toIsoString(row.refundedAt),
    failedReason: row.failedReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCallback(
  row: typeof paymentCallbacks.$inferSelect,
): PaymentCallbackRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    gateway: row.gateway,
    externalId: row.externalId,
    event: row.event,
    signatureVerified: row.signatureVerified,
    processingStatus: row.processingStatus,
    failureReason: row.failureReason,
    processedAt: row.processedAt,
  };
}

function resolveOrderPaymentStatus(input: {
  totalAmount: string;
  paidAmount: string;
}): OrderPaymentStatus {
  const paid = amountToCents(input.paidAmount);
  const total = amountToCents(input.totalAmount);

  if (paid <= BigInt(0)) {
    return "unpaid";
  }

  if (paid >= total) {
    return "paid";
  }

  return "partial";
}

function clampNonNegativeAmount(value: string): string {
  const cents = amountToCents(value);

  return cents <= BigInt(0) ? "0.00" : centsToAmount(cents);
}

export class PaymentRepository {
  constructor(private readonly db: Database) {}

  async findOwnedOrder(input: {
    tenantId: string;
    customerAccountId: string;
    orderId: string;
  }): Promise<PaymentOrderRecord | null> {
    const rows = await this.db
      .select({
        id: orders.id,
        tenantId: orders.tenantId,
        branchId: orders.branchId,
        currency: orders.currency,
        customerId: orders.customerId,
        customerAccountId: customers.customerAccountId,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        totalAmount: orders.totalAmount,
        paidAmount: orders.paidAmount,
        paidAt: orders.paidAt,
        version: orders.version,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(
        and(
          eq(orders.id, input.orderId),
          eq(orders.tenantId, input.tenantId),
          eq(customers.tenantId, input.tenantId),
          eq(customers.customerAccountId, input.customerAccountId),
          isNull(orders.deletedAt),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1);

    const row = rows[0];
    return row?.customerId ? { ...row, customerId: row.customerId } : null;
  }

  async findTransactionByIdempotencyKey(input: {
    tenantId: string;
    idempotencyKey: string;
  }): Promise<CustomerPaymentTransaction | null> {
    const rows = await this.db
      .select({ ...getTableColumns(paymentTransactions) })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.tenantId, input.tenantId),
          eq(paymentTransactions.idempotencyKey, input.idempotencyKey),
          isNull(paymentTransactions.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ? toTransaction(rows[0]) : null;
  }

  async findOwnedTransaction(input: {
    tenantId: string;
    customerAccountId: string;
    transactionId: string;
  }): Promise<CustomerPaymentTransaction | null> {
    const rows = await this.db
      .select({ transaction: getTableColumns(paymentTransactions) })
      .from(paymentTransactions)
      .innerJoin(customers, eq(customers.id, paymentTransactions.customerId))
      .where(
        and(
          eq(paymentTransactions.id, input.transactionId),
          eq(paymentTransactions.tenantId, input.tenantId),
          eq(customers.tenantId, input.tenantId),
          eq(customers.customerAccountId, input.customerAccountId),
          isNull(paymentTransactions.deletedAt),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ? toTransaction(rows[0].transaction) : null;
  }

  async findPendingTransactionForOrder(input: {
    tenantId: string;
    orderId: string;
  }): Promise<CustomerPaymentTransaction | null> {
    const rows = await this.db
      .select({ ...getTableColumns(paymentTransactions) })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.tenantId, input.tenantId),
          eq(paymentTransactions.orderId, input.orderId),
          eq(paymentTransactions.paymentStatus, "pending"),
          eq(paymentTransactions.paymentMethod, "app"),
          isNull(paymentTransactions.deletedAt),
        ),
      )
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(1);

    return rows[0] ? toTransaction(rows[0]) : null;
  }

  async findTransactionByExternalId(input: {
    tenantId: string;
    gateway: PaymentGatewayName;
    externalId: string;
  }): Promise<CustomerPaymentTransaction | null> {
    const rows = await this.db
      .select({ ...getTableColumns(paymentTransactions) })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.tenantId, input.tenantId),
          eq(paymentTransactions.gateway, input.gateway),
          eq(paymentTransactions.externalId, input.externalId),
          isNull(paymentTransactions.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ? toTransaction(rows[0]) : null;
  }

  async createPendingTransaction(input: {
    tenantId: string;
    branchId: string;
    customerId: string;
    orderId: string;
    amount: string;
    currency: string;
    idempotencyKey: string;
  }): Promise<{
    transaction: CustomerPaymentTransaction;
    idempotent: boolean;
  }> {
    const [inserted] = await this.db
      .insert(paymentTransactions)
      .values({
        id: createId(),
        tenantId: input.tenantId,
        branchId: input.branchId,
        customerId: input.customerId,
        orderId: input.orderId,
        paymentMethod: "app",
        amount: input.amount,
        currency: input.currency,
        paymentStatus: "pending",
        idempotencyKey: input.idempotencyKey,
        initiatorType: "customer",
      })
      .onConflictDoNothing({
        target: [
          paymentTransactions.tenantId,
          paymentTransactions.idempotencyKey,
        ],
      })
      .returning({ ...getTableColumns(paymentTransactions) });

    if (inserted) {
      return { transaction: toTransaction(inserted), idempotent: false };
    }

    const existing = await this.findTransactionByIdempotencyKey({
      tenantId: input.tenantId,
      idempotencyKey: input.idempotencyKey,
    });

    if (!existing) {
      throw new Error("Payment transaction insert failed.");
    }

    return { transaction: existing, idempotent: true };
  }

  async attachGatewayPayment(input: {
    tenantId: string;
    transactionId: string;
    gateway: PaymentGatewayName;
    externalId: string;
  }): Promise<CustomerPaymentTransaction> {
    const now = new Date();
    const [updated] = await this.db
      .update(paymentTransactions)
      .set({
        gateway: input.gateway,
        externalId: input.externalId,
        updatedAt: now,
        version: sql`${paymentTransactions.version} + 1`,
      })
      .where(
        and(
          eq(paymentTransactions.tenantId, input.tenantId),
          eq(paymentTransactions.id, input.transactionId),
        ),
      )
      .returning({ ...getTableColumns(paymentTransactions) });

    if (!updated) {
      throw new Error("Payment transaction gateway update failed.");
    }

    return toTransaction(updated);
  }

  async recordCallback(input: {
    tenantId: string | null;
    gateway: PaymentGatewayName;
    externalId: string;
    event: string;
    signatureVerified: boolean;
    rawPayload: Record<string, unknown>;
  }): Promise<{ callback: PaymentCallbackRecord; idempotent: boolean }> {
    const [inserted] = await this.db
      .insert(paymentCallbacks)
      .values({
        id: createId(),
        tenantId: input.tenantId,
        gateway: input.gateway,
        externalId: input.externalId,
        event: input.event,
        signatureVerified: input.signatureVerified,
        rawPayload: input.rawPayload,
        processingStatus: "received",
      })
      .onConflictDoNothing({
        target: [
          paymentCallbacks.gateway,
          paymentCallbacks.externalId,
          paymentCallbacks.event,
        ],
        where: sql`${paymentCallbacks.signatureVerified} = true`,
      })
      .returning({ ...getTableColumns(paymentCallbacks) });

    if (inserted) {
      return { callback: toCallback(inserted), idempotent: false };
    }

    const [existing] = await this.db
      .select({ ...getTableColumns(paymentCallbacks) })
      .from(paymentCallbacks)
      .where(
        and(
          input.tenantId
            ? eq(paymentCallbacks.tenantId, input.tenantId)
            : isNull(paymentCallbacks.tenantId),
          eq(paymentCallbacks.gateway, input.gateway),
          eq(paymentCallbacks.externalId, input.externalId),
          eq(paymentCallbacks.event, input.event),
          eq(paymentCallbacks.signatureVerified, true),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error("Payment callback insert failed.");
    }

    return { callback: toCallback(existing), idempotent: true };
  }

  async markCallback(input: {
    tenantId: string | null;
    callbackId: string;
    status: "processed" | "rejected" | "failed";
    failureReason?: string | null;
  }): Promise<void> {
    await this.db
      .update(paymentCallbacks)
      .set({
        processingStatus: input.status,
        failureReason: input.failureReason,
        processedAt: new Date(),
      })
      .where(
        and(
          input.tenantId
            ? eq(paymentCallbacks.tenantId, input.tenantId)
            : isNull(paymentCallbacks.tenantId),
          eq(paymentCallbacks.id, input.callbackId),
        ),
      );
  }

  async reconcilePaymentCallback(input: {
    callbackId: string;
    verification: PaymentGatewayCallbackVerification;
  }): Promise<CustomerPaymentTransaction | null> {
    return this.db.transaction(async (tx) => {
      const repository = new PaymentRepository(tx);
      const transaction = input.verification.transactionId
        ? await repository.findTransactionForUpdate({
            tenantId: input.verification.tenantId,
            transactionId: input.verification.transactionId,
          })
        : await repository.findTransactionByExternalId({
            tenantId: input.verification.tenantId,
            gateway: input.verification.gateway,
            externalId: input.verification.externalId,
          });

      if (!transaction) {
        await repository.markCallback({
          tenantId: input.verification.tenantId,
          callbackId: input.callbackId,
          status: "failed",
          failureReason: "Payment transaction was not found.",
        });
        return null;
      }

      if (
        transaction.externalId !== input.verification.externalId ||
        compareAmounts(transaction.amount, input.verification.amount) !== 0
      ) {
        await repository.markCallback({
          tenantId: input.verification.tenantId,
          callbackId: input.callbackId,
          status: "failed",
          failureReason: "Payment callback did not match the transaction.",
        });
        return null;
      }

      if (transaction.paymentStatus === input.verification.status) {
        await repository.markCallback({
          tenantId: input.verification.tenantId,
          callbackId: input.callbackId,
          status: "processed",
        });
        return transaction;
      }

      if (
        transaction.paymentStatus === "paid" &&
        input.verification.status !== "refunded"
      ) {
        await repository.markCallback({
          tenantId: input.verification.tenantId,
          callbackId: input.callbackId,
          status: "processed",
        });
        return transaction;
      }

      const now = new Date();
      const status: PaymentTransactionStatus = input.verification.status;
      const [updatedTransaction] = await tx
        .update(paymentTransactions)
        .set({
          paymentStatus: status,
          paidAt: status === "paid" ? input.verification.occurredAt : undefined,
          updatedAt: now,
          version: sql`${paymentTransactions.version} + 1`,
        })
        .where(
          and(
            eq(paymentTransactions.id, transaction.id),
            eq(paymentTransactions.tenantId, input.verification.tenantId),
            isNull(paymentTransactions.deletedAt),
          ),
        )
        .returning({ ...getTableColumns(paymentTransactions) });

      if (!updatedTransaction) {
        await repository.markCallback({
          tenantId: input.verification.tenantId,
          callbackId: input.callbackId,
          status: "failed",
          failureReason: "Payment transaction update failed.",
        });
        return null;
      }

      if (status === "paid") {
        await repository.updateOrderAfterPayment({
          tenantId: transaction.tenantId,
          orderId: transaction.orderId,
          amount: transaction.amount,
          paidAt: input.verification.occurredAt,
        });
      } else if (status === "failed") {
        await tx
          .update(paymentTransactions)
          .set({
            paidAt: null,
            updatedAt: now,
            version: sql`${paymentTransactions.version} + 1`,
          })
          .where(
            and(
              eq(paymentTransactions.tenantId, transaction.tenantId),
              eq(paymentTransactions.id, transaction.id),
            ),
          );
      }

      await repository.markCallback({
        tenantId: input.verification.tenantId,
        callbackId: input.callbackId,
        status: "processed",
      });

      return toTransaction(updatedTransaction);
    });
  }

  async createRefundRequest(input: {
    tenantId: string;
    branchId: string;
    customerAccountId: string;
    customerId: string;
    orderId: string;
    amount: string;
    currency: string;
    reason: string;
    paymentTransactionId?: string | null;
  }): Promise<RefundRequest | null> {
    const [created] = await this.db
      .insert(refundRequests)
      .values({
        id: createId(),
        tenantId: input.tenantId,
        branchId: input.branchId,
        customerAccountId: input.customerAccountId,
        customerId: input.customerId,
        orderId: input.orderId,
        paymentTransactionId: input.paymentTransactionId,
        amount: input.amount,
        currency: input.currency,
        reason: input.reason,
        status: "pending",
      })
      .onConflictDoNothing({
        target: [refundRequests.tenantId, refundRequests.orderId],
        where: sql`${refundRequests.deletedAt} is null and ${refundRequests.status} in ('pending', 'processing')`,
      })
      .returning({ ...getTableColumns(refundRequests) });

    return created ? toRefundRequest(created) : null;
  }

  async listRefundRequests(input: {
    tenantId: string;
    customerAccountId?: string;
    branchIds?: string[];
    status?: RefundRequestStatus;
  }): Promise<RefundRequest[]> {
    const rows = await this.db
      .select({ ...getTableColumns(refundRequests) })
      .from(refundRequests)
      .where(
        and(
          eq(refundRequests.tenantId, input.tenantId),
          input.customerAccountId
            ? eq(refundRequests.customerAccountId, input.customerAccountId)
            : undefined,
          input.branchIds && input.branchIds.length > 0
            ? inArray(refundRequests.branchId, input.branchIds)
            : undefined,
          input.status ? eq(refundRequests.status, input.status) : undefined,
          isNull(refundRequests.deletedAt),
        ),
      )
      .orderBy(desc(refundRequests.createdAt));

    return rows.map(toRefundRequest);
  }

  async sumOpenRefundRequests(input: {
    tenantId: string;
    orderId: string;
    excludeRefundRequestId?: string;
  }): Promise<string> {
    const [row] = await this.db
      .select({
        amount: sql<string>`coalesce(sum(${refundRequests.amount}), 0)::text`,
      })
      .from(refundRequests)
      .where(
        and(
          eq(refundRequests.tenantId, input.tenantId),
          eq(refundRequests.orderId, input.orderId),
          inArray(refundRequests.status, ["pending", "processing"]),
          input.excludeRefundRequestId
            ? ne(refundRequests.id, input.excludeRefundRequestId)
            : undefined,
          isNull(refundRequests.deletedAt),
        ),
      );

    return row?.amount ?? "0.00";
  }

  async findRefundRequest(input: {
    tenantId: string;
    refundRequestId: string;
  }): Promise<RefundRequest | null> {
    const [row] = await this.db
      .select({ ...getTableColumns(refundRequests) })
      .from(refundRequests)
      .where(
        and(
          eq(refundRequests.tenantId, input.tenantId),
          eq(refundRequests.id, input.refundRequestId),
          isNull(refundRequests.deletedAt),
        ),
      )
      .limit(1);

    return row ? toRefundRequest(row) : null;
  }

  async getRefundOrderDetail(input: {
    tenantId: string;
    orderId: string;
  }): Promise<RefundOrderDetail | null> {
    const [order] = await this.db
      .select({ ...getTableColumns(orders) })
      .from(orders)
      .where(
        and(
          eq(orders.id, input.orderId),
          eq(orders.tenantId, input.tenantId),
          isNull(orders.deletedAt),
        ),
      )
      .limit(1);

    if (!order) {
      return null;
    }
    if (!order.customerId) {
      return null;
    }

    const items = await this.db
      .select({
        id: orderItems.id,
        itemName: orderItems.itemName,
        quantity: orderItems.quantity,
        unitAmount: orderItems.unitAmount,
        lineAmount: orderItems.lineAmount,
      })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.tenantId, input.tenantId),
          eq(orderItems.orderId, order.id),
          isNull(orderItems.deletedAt),
        ),
      )
      .orderBy(asc(orderItems.createdAt));

    return {
      id: order.id,
      branchId: order.branchId,
      currency: order.currency,
      customerId: order.customerId,
      orderType: order.orderType,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      paidAmount: order.paidAmount,
      notes: order.notes,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items,
    };
  }

  async startRefundProcessing(input: {
    tenantId: string;
    refundRequestId: string;
    operatorUserId: string;
  }): Promise<RefundRequest | null> {
    const now = new Date();
    const [row] = await this.db
      .update(refundRequests)
      .set({
        status: "processing",
        approvedAt: now,
        approvedBy: input.operatorUserId,
        updatedAt: now,
        version: sql`${refundRequests.version} + 1`,
      })
      .where(
        and(
          eq(refundRequests.id, input.refundRequestId),
          eq(refundRequests.tenantId, input.tenantId),
          eq(refundRequests.status, "pending"),
          isNull(refundRequests.deletedAt),
        ),
      )
      .returning({ ...getTableColumns(refundRequests) });

    return row ? toRefundRequest(row) : null;
  }

  async attachRefundGateway(input: {
    tenantId: string;
    refundRequestId: string;
    gateway: PaymentGatewayName;
    externalId: string;
  }): Promise<RefundRequest | null> {
    const now = new Date();
    const [row] = await this.db
      .update(refundRequests)
      .set({
        gateway: input.gateway,
        externalId: input.externalId,
        updatedAt: now,
        version: sql`${refundRequests.version} + 1`,
      })
      .where(
        and(
          eq(refundRequests.id, input.refundRequestId),
          eq(refundRequests.tenantId, input.tenantId),
          eq(refundRequests.status, "processing"),
          isNull(refundRequests.deletedAt),
        ),
      )
      .returning({ ...getTableColumns(refundRequests) });

    return row ? toRefundRequest(row) : null;
  }

  async rejectRefundRequest(input: {
    tenantId: string;
    refundRequestId: string;
    operatorUserId: string;
    reason: string;
  }): Promise<RefundRequest | null> {
    const now = new Date();
    const [row] = await this.db
      .update(refundRequests)
      .set({
        status: "rejected",
        rejectedAt: now,
        rejectedBy: input.operatorUserId,
        rejectionReason: input.reason,
        updatedAt: now,
        version: sql`${refundRequests.version} + 1`,
      })
      .where(
        and(
          eq(refundRequests.id, input.refundRequestId),
          eq(refundRequests.tenantId, input.tenantId),
          eq(refundRequests.status, "pending"),
          isNull(refundRequests.deletedAt),
        ),
      )
      .returning({ ...getTableColumns(refundRequests) });

    return row ? toRefundRequest(row) : null;
  }

  async reconcileRefundCallback(input: {
    callbackId: string;
    verification: PaymentGatewayCallbackVerification;
  }): Promise<RefundRequest | null> {
    return this.db.transaction(async (tx) => {
      const repository = new PaymentRepository(tx);
      const refundRequest = input.verification.refundRequestId
        ? await repository.findRefundRequest({
            tenantId: input.verification.tenantId,
            refundRequestId: input.verification.refundRequestId,
          })
        : await repository.findRefundRequestByExternalId({
            tenantId: input.verification.tenantId,
            gateway: input.verification.gateway,
            externalId: input.verification.externalId,
          });

      if (!refundRequest) {
        await repository.markCallback({
          tenantId: input.verification.tenantId,
          callbackId: input.callbackId,
          status: "failed",
          failureReason: "Refund request was not found.",
        });
        return null;
      }

      if (
        refundRequest.externalId !== input.verification.externalId ||
        compareAmounts(refundRequest.amount, input.verification.amount) !== 0
      ) {
        await repository.markCallback({
          tenantId: input.verification.tenantId,
          callbackId: input.callbackId,
          status: "failed",
          failureReason: "Refund callback did not match the request.",
        });
        return null;
      }

      if (refundRequest.status === "refunded") {
        await repository.markCallback({
          tenantId: input.verification.tenantId,
          callbackId: input.callbackId,
          status: "processed",
        });
        return refundRequest;
      }

      const now = new Date();
      const nextStatus: RefundRequestStatus =
        input.verification.status === "refunded" ? "refunded" : "failed";
      const [updatedRefund] = await tx
        .update(refundRequests)
        .set({
          status: nextStatus,
          refundedAt:
            nextStatus === "refunded" ? input.verification.occurredAt : null,
          failedReason:
            nextStatus === "failed"
              ? (input.verification.failureReason ?? "Refund failed.")
              : null,
          updatedAt: now,
          version: sql`${refundRequests.version} + 1`,
        })
        .where(
          and(
            eq(refundRequests.id, refundRequest.id),
            eq(refundRequests.tenantId, input.verification.tenantId),
            isNull(refundRequests.deletedAt),
          ),
        )
        .returning({ ...getTableColumns(refundRequests) });

      if (!updatedRefund) {
        await repository.markCallback({
          tenantId: input.verification.tenantId,
          callbackId: input.callbackId,
          status: "failed",
          failureReason: "Refund request update failed.",
        });
        return null;
      }

      if (nextStatus === "refunded") {
        await repository.updateOrderAfterRefund({
          tenantId: refundRequest.tenantId,
          orderId: refundRequest.orderId,
          amount: refundRequest.amount,
        });

        if (refundRequest.paymentTransactionId) {
          await repository.markTransactionRefundedIfCovered({
            tenantId: refundRequest.tenantId,
            transactionId: refundRequest.paymentTransactionId,
            refundAmount: refundRequest.amount,
          });
        }
      }

      await repository.markCallback({
        tenantId: input.verification.tenantId,
        callbackId: input.callbackId,
        status: "processed",
      });

      return toRefundRequest(updatedRefund);
    });
  }

  async sumPaidTransactions(input: {
    tenantId: string;
    orderId: string;
  }): Promise<string> {
    const [row] = await this.db
      .select({
        amount: sql<string>`coalesce(sum(${paymentTransactions.amount}), 0)::text`,
      })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.tenantId, input.tenantId),
          eq(paymentTransactions.orderId, input.orderId),
          eq(paymentTransactions.paymentStatus, "paid"),
          isNull(paymentTransactions.deletedAt),
        ),
      );

    return row?.amount ?? "0.00";
  }

  async listPaidTransactionsForOrder(input: {
    tenantId: string;
    orderId: string;
  }): Promise<CustomerPaymentTransaction[]> {
    const rows = await this.db
      .select({ ...getTableColumns(paymentTransactions) })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.tenantId, input.tenantId),
          eq(paymentTransactions.orderId, input.orderId),
          eq(paymentTransactions.paymentStatus, "paid"),
          isNull(paymentTransactions.deletedAt),
        ),
      )
      .orderBy(asc(paymentTransactions.createdAt));

    return rows.map(toTransaction);
  }

  private async findTransactionForUpdate(input: {
    tenantId: string;
    transactionId: string;
  }): Promise<CustomerPaymentTransaction | null> {
    const rows = await this.db
      .select({ ...getTableColumns(paymentTransactions) })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.id, input.transactionId),
          eq(paymentTransactions.tenantId, input.tenantId),
          isNull(paymentTransactions.deletedAt),
        ),
      )
      .limit(1)
      .for("update");

    return rows[0] ? toTransaction(rows[0]) : null;
  }

  private async updateOrderAfterPayment(input: {
    tenantId: string;
    orderId: string;
    amount: string;
    paidAt: Date;
  }): Promise<void> {
    const [order] = await this.db
      .select({
        id: orders.id,
        totalAmount: orders.totalAmount,
        paidAmount: orders.paidAmount,
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
      .limit(1)
      .for("update");

    if (!order) {
      throw new Error("Order was not found while reconciling payment.");
    }

    const paidAmount = addAmounts(order.paidAmount, input.amount);
    const paymentStatus = resolveOrderPaymentStatus({
      totalAmount: order.totalAmount,
      paidAmount,
    });
    const fulfilment = await findPosOrderFulfilmentState(this.db, {
      tenantId: input.tenantId,
      orderId: input.orderId,
    });
    const now = new Date();

    await this.db
      .update(orders)
      .set({
        paidAmount,
        paymentStatus,
        status:
          paymentStatus === "paid" && order.status === "received"
            ? fulfilment.isProductOnly
              ? "delivered"
              : "paid"
            : order.status,
        paidAt: paymentStatus === "unpaid" ? null : input.paidAt,
        updatedAt: now,
        version: sql`${orders.version} + 1`,
      })
      .where(
        and(eq(orders.tenantId, input.tenantId), eq(orders.id, input.orderId)),
      );
  }

  private async updateOrderAfterRefund(input: {
    tenantId: string;
    orderId: string;
    amount: string;
  }): Promise<void> {
    const [order] = await this.db
      .select({
        id: orders.id,
        totalAmount: orders.totalAmount,
        paidAmount: orders.paidAmount,
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
      .limit(1)
      .for("update");

    if (!order) {
      throw new Error("Order was not found while reconciling refund.");
    }

    const paidAmount = clampNonNegativeAmount(
      subtractAmounts(order.paidAmount, input.amount),
    );
    const paymentStatus =
      compareAmounts(paidAmount, "0.00") === 0
        ? "refunded"
        : resolveOrderPaymentStatus({
            totalAmount: order.totalAmount,
            paidAmount,
          });
    const now = new Date();

    await this.db
      .update(orders)
      .set({
        paidAmount,
        paymentStatus,
        paidAt: paymentStatus === "refunded" ? null : undefined,
        status:
          order.status === "paid" && paymentStatus !== "paid"
            ? "received"
            : order.status,
        updatedAt: now,
        version: sql`${orders.version} + 1`,
      })
      .where(
        and(eq(orders.tenantId, input.tenantId), eq(orders.id, input.orderId)),
      );
  }

  private async markTransactionRefundedIfCovered(input: {
    tenantId: string;
    transactionId: string;
    refundAmount: string;
  }): Promise<void> {
    const [transaction] = await this.db
      .select({
        id: paymentTransactions.id,
        amount: paymentTransactions.amount,
      })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.tenantId, input.tenantId),
          eq(paymentTransactions.id, input.transactionId),
        ),
      )
      .limit(1);

    if (!transaction) {
      return;
    }

    if (compareAmounts(input.refundAmount, transaction.amount) < 0) {
      return;
    }

    await this.db
      .update(paymentTransactions)
      .set({
        paymentStatus: "refunded",
        updatedAt: new Date(),
        version: sql`${paymentTransactions.version} + 1`,
      })
      .where(
        and(
          eq(paymentTransactions.tenantId, input.tenantId),
          eq(paymentTransactions.id, input.transactionId),
        ),
      );
  }

  private async findRefundRequestByExternalId(input: {
    tenantId: string;
    gateway: PaymentGatewayName;
    externalId: string;
  }): Promise<RefundRequest | null> {
    const [row] = await this.db
      .select({ ...getTableColumns(refundRequests) })
      .from(refundRequests)
      .where(
        and(
          eq(refundRequests.tenantId, input.tenantId),
          eq(refundRequests.gateway, input.gateway),
          eq(refundRequests.externalId, input.externalId),
          isNull(refundRequests.deletedAt),
        ),
      )
      .limit(1);

    return row ? toRefundRequest(row) : null;
  }
}
