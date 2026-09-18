import {
  getDb,
  inventoryBalances,
  inventoryMovements,
  orderItems,
  orders,
  paymentTransactions,
  productSkus,
  salesReturnItems,
  salesReturns,
  type Database,
} from "@cleanhub/db";
import { compareAmounts, subtractAmounts } from "@cleanhub/domain/money";
import { createId } from "@cleanhub/id";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import {
  authorizePosSensitiveOperation,
  createPosAuditMetadata,
  requirePosBranchAccess,
  requirePosTenantId,
} from "../access-control.helper.js";
import { applyPosOrderFinancialRules } from "../orders/orders.financial.js";
import { consumeProductInventoryForPaidOrder } from "../orders/orders.inventory.js";
import { PosOrderError } from "../orders/orders.errors.js";
import { createPosOrder, getPosOrder } from "../orders/orders.service.js";
import {
  insertPaymentAdjustment,
  lockAdjustmentOrder,
  recalculateOrderAfterAdjustment,
  sumRefundedForPayment,
} from "../payment-adjustments/payment-adjustments.repository.js";
import type { PosAdjustmentOrder } from "../payment-adjustments/payment-adjustments.repository.js";
import { createPosRefund } from "../payment-adjustments/payment-adjustments.service.js";
import type { CreatePosPaymentAdjustmentResponse } from "../payment-adjustments/payment-adjustments.types.js";
import type {
  CreatePosProductReturnRequest,
  CreatePosProductReturnResponse,
  PosProductReturn,
  PosProductReturnsOverview,
  PosReturnableProductItem,
} from "./returns.types.js";

function money(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function calculateReturnSettlement(
  returnValueAmount: number,
  exchangeTotalAmount: number,
): {
  refundAmount: number;
  exchangeCreditAmount: number;
  additionalDueAmount: number;
} {
  const normalizedReturnValue = Math.max(0, Number(money(returnValueAmount)));
  const normalizedExchangeTotal = Math.max(
    0,
    Number(money(exchangeTotalAmount)),
  );
  const exchangeCreditAmount = Math.min(
    normalizedReturnValue,
    normalizedExchangeTotal,
  );
  return {
    refundAmount: normalizedReturnValue - exchangeCreditAmount,
    exchangeCreditAmount,
    additionalDueAmount: Math.max(
      0,
      normalizedExchangeTotal - exchangeCreditAmount,
    ),
  };
}

async function allocateRefundAcrossPaidPayments(
  db: Database,
  input: { tenantId: string; orderId: string; amount: number },
): Promise<Array<{ originalPaymentId: string; amount: string }>> {
  let remaining = Number(money(input.amount));
  if (remaining <= 0) return [];
  const payments = await db
    .select({
      id: paymentTransactions.id,
      amount: paymentTransactions.amount,
    })
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
  const allocations: Array<{ originalPaymentId: string; amount: string }> = [];
  for (const payment of payments) {
    const reservedOrRefunded = await sumRefundedForPayment(db, {
      tenantId: input.tenantId,
      paymentId: payment.id,
    });
    // Compute the remaining refundable balance exactly before dropping to a
    // number: a float subtraction here can report a cent of headroom that the
    // payment does not actually have, which createPosRefund would then reject.
    const availableAmount = subtractAmounts(payment.amount, reservedOrRefunded);
    const available =
      compareAmounts(availableAmount, "0") < 0 ? 0 : Number(availableAmount);
    const allocated = Math.min(available, remaining);
    if (allocated > 0) {
      allocations.push({
        originalPaymentId: payment.id,
        amount: money(allocated),
      });
      remaining = Number(money(remaining - allocated));
    }
    if (remaining <= 0) break;
  }
  if (remaining > 0) {
    throw new PosOrderError(
      "PAYMENT_AMOUNT_EXCEEDED",
      "The order no longer has enough refundable payment balance.",
      409,
    );
  }
  return allocations;
}

async function loadProductReturns(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<PosProductReturn[]> {
  const returnRows = await db
    .select()
    .from(salesReturns)
    .where(
      and(
        eq(salesReturns.tenantId, input.tenantId),
        eq(salesReturns.orderId, input.orderId),
        inArray(salesReturns.status, ["received", "completed"]),
      ),
    )
    .orderBy(salesReturns.createdAt);
  if (returnRows.length === 0) return [];
  const itemRows = await db
    .select()
    .from(salesReturnItems)
    .where(
      and(
        eq(salesReturnItems.tenantId, input.tenantId),
        inArray(
          salesReturnItems.salesReturnId,
          returnRows.map((row) => row.id),
        ),
      ),
    );
  return returnRows.map((row) => ({
    id: row.id,
    orderId: row.orderId,
    exchangeOrderId: row.exchangeOrderId,
    status: row.status as "received" | "completed",
    reason: row.reason,
    notes: row.notes,
    refundAmount: row.refundAmount,
    returnValueAmount: row.returnValueAmount,
    exchangeCreditAmount: row.exchangeCreditAmount,
    additionalDueAmount: row.additionalDueAmount,
    currency: row.currency,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    items: itemRows
      .filter((item) => item.salesReturnId === row.id)
      .map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        productSkuId: item.productSkuId,
        quantity: item.quantity,
        condition: item.condition,
        disposition: item.disposition,
        refundAmount: item.refundAmount,
        reason: item.reason,
      })),
  }));
}

async function loadReturnableItems(
  db: Database,
  input: { tenantId: string; branchId: string; orderId: string },
): Promise<PosReturnableProductItem[]> {
  const rows = await db
    .select({
      orderItemId: orderItems.id,
      productSkuId: orderItems.productSkuId,
      itemName: orderItems.itemName,
      sku: productSkus.skuCode,
      quantity: orderItems.quantity,
      lineAmount: orderItems.lineAmount,
      trackInventory: productSkus.trackInventory,
    })
    .from(orderItems)
    .innerJoin(
      productSkus,
      and(
        eq(productSkus.tenantId, orderItems.tenantId),
        eq(productSkus.id, orderItems.productSkuId),
      ),
    )
    .where(
      and(
        eq(orderItems.tenantId, input.tenantId),
        eq(orderItems.orderId, input.orderId),
        eq(orderItems.itemKind, "product"),
        isNull(orderItems.deletedAt),
      ),
    );
  if (rows.length === 0) return [];
  const returnedRows = await db
    .select({
      orderItemId: salesReturnItems.orderItemId,
      quantity: sql<string>`coalesce(sum(${salesReturnItems.quantity}), 0)`,
    })
    .from(salesReturnItems)
    .innerJoin(
      salesReturns,
      and(
        eq(salesReturns.tenantId, salesReturnItems.tenantId),
        eq(salesReturns.id, salesReturnItems.salesReturnId),
        inArray(salesReturns.status, ["received", "completed"]),
      ),
    )
    .where(
      and(
        eq(salesReturnItems.tenantId, input.tenantId),
        inArray(
          salesReturnItems.orderItemId,
          rows.map((row) => row.orderItemId),
        ),
      ),
    )
    .groupBy(salesReturnItems.orderItemId);
  const returned = new Map(
    returnedRows.map((row) => [row.orderItemId, Number(row.quantity)]),
  );
  return rows
    .filter((row): row is typeof row & { productSkuId: string } =>
      Boolean(row.productSkuId),
    )
    .map((row) => {
      const returnedQuantity = returned.get(row.orderItemId) ?? 0;
      return {
        orderItemId: row.orderItemId,
        productSkuId: row.productSkuId,
        itemName: row.itemName,
        sku: row.sku,
        purchasedQuantity: row.quantity,
        returnedQuantity: String(returnedQuantity),
        returnableQuantity: String(
          Math.max(0, Number(row.quantity) - returnedQuantity),
        ),
        lineAmount: row.lineAmount,
        trackInventory: row.trackInventory,
      };
    });
}

export async function getPosProductReturns(
  authContext: AuthContext,
  orderId: string,
  db: Database = getDb(),
): Promise<PosProductReturnsOverview> {
  const tenantId = requirePosTenantId(authContext);
  const [order] = await db
    .select({ branchId: orders.branchId })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.id, orderId),
        isNull(orders.deletedAt),
      ),
    )
    .limit(1);
  if (!order)
    throw new PosOrderError("ORDER_NOT_FOUND", "Order not found.", 404);
  requirePosBranchAccess(authContext, order.branchId);
  const [data, returnableItems] = await Promise.all([
    loadProductReturns(db, { tenantId, orderId }),
    loadReturnableItems(db, { tenantId, branchId: order.branchId, orderId }),
  ]);
  return { data, returnableItems };
}

export async function createPosProductReturn(
  input: {
    authContext: AuthContext;
    orderId: string;
    data: CreatePosProductReturnRequest;
    requestMeta?: AuthRequestMeta;
  },
  db: Database = getDb(),
): Promise<CreatePosProductReturnResponse> {
  const tenantId = requirePosTenantId(input.authContext);
  const reason = authorizePosSensitiveOperation(
    input.authContext,
    "refund",
    input.data.reason,
  );

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.id, input.orderId),
          isNull(orders.deletedAt),
        ),
      )
      .for("update")
      .limit(1);
    if (!order)
      throw new PosOrderError("ORDER_NOT_FOUND", "Order not found.", 404);
    requirePosBranchAccess(input.authContext, order.branchId);
    if (order.status === "cancelled" || Number(order.paidAmount) <= 0) {
      throw new PosOrderError(
        "VALIDATION_ERROR",
        "Only an order with a captured payment can be returned.",
        422,
      );
    }

    const [existing] = await tx
      .select()
      .from(salesReturns)
      .where(
        and(
          eq(salesReturns.tenantId, tenantId),
          eq(salesReturns.idempotencyKey, input.data.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing) {
      if (existing.orderId !== order.id) {
        throw new PosOrderError(
          "PAYMENT_REFERENCE_CONFLICT",
          "The return idempotency key is already used by another order.",
          409,
        );
      }
      const [salesReturn] = await loadProductReturns(tx, {
        tenantId,
        orderId: order.id,
      }).then((rows) => rows.filter((row) => row.id === existing.id));
      if (!salesReturn)
        throw new Error("Existing product return could not be loaded.");
      const exchangeOrder = existing.exchangeOrderId
        ? await getPosOrder(
            {
              authContext: input.authContext,
              orderId: existing.exchangeOrderId,
            },
            tx,
          )
        : null;
      return { salesReturn, exchangeOrder };
    }

    const uniqueItemIds = new Set(
      input.data.items.map((item) => item.orderItemId),
    );
    if (uniqueItemIds.size !== input.data.items.length) {
      throw new PosOrderError(
        "VALIDATION_ERROR",
        "Each order item can appear only once in a return.",
        422,
      );
    }
    const returnableItems = await loadReturnableItems(tx, {
      tenantId,
      branchId: order.branchId,
      orderId: order.id,
    });
    const returnableById = new Map(
      returnableItems.map((item) => [item.orderItemId, item]),
    );
    let grossReturned = 0;
    for (const item of input.data.items) {
      const source = returnableById.get(item.orderItemId);
      if (
        !source ||
        Number(item.quantity) > Number(source.returnableQuantity)
      ) {
        throw new PosOrderError(
          "VALIDATION_ERROR",
          "A returned quantity exceeds the remaining purchased quantity.",
          422,
        );
      }
      if (item.disposition === "restock" && !source.trackInventory) {
        throw new PosOrderError(
          "VALIDATION_ERROR",
          `${source.itemName} is not inventory-tracked and cannot be restocked.`,
          422,
        );
      }
      grossReturned +=
        (Number(source.lineAmount) * Number(item.quantity)) /
        Number(source.purchasedQuantity);
    }
    const grossSubtotal = Number(order.subtotalAmount);
    const pricedReturn =
      grossSubtotal > 0
        ? (Number(order.totalAmount) * grossReturned) / grossSubtotal
        : 0;
    const returnValueAmount = Math.min(
      Number(money(pricedReturn)),
      Number(order.paidAmount),
    );
    let exchangeOrderId: string | null = null;
    let exchangeOrder: PosAdjustmentOrder | null = null;
    if (input.data.exchangeItems?.length) {
      const exchange = await createPosOrder(
        {
          authContext: input.authContext,
          requestMeta: input.requestMeta,
          data: {
            id: createId(),
            orderType: "manual",
            branchId: order.branchId,
            customerId: order.customerId ?? undefined,
            notes: `Exchange for return on ${order.id}`,
            items: input.data.exchangeItems,
          },
        },
        tx,
      );
      exchangeOrderId = exchange.id;
      await applyPosOrderFinancialRules(tx, {
        authContext: input.authContext,
        tenantId,
        orderId: exchange.id,
        actorUserId: input.authContext.userId,
      });
      exchangeOrder = await lockAdjustmentOrder(tx, {
        tenantId,
        orderId: exchange.id,
      });
      if (!exchangeOrder) {
        throw new Error("Exchange order could not be locked.");
      }
    }

    const { additionalDueAmount, exchangeCreditAmount, refundAmount } =
      calculateReturnSettlement(
        returnValueAmount,
        Number(exchangeOrder?.totalAmount ?? 0),
      );
    const refundAllocations: NonNullable<
      CreatePosProductReturnRequest["refundAllocations"]
    > =
      input.data.refundAllocations ??
      (await allocateRefundAcrossPaidPayments(tx, {
        tenantId,
        orderId: order.id,
        amount: refundAmount,
      }));
    const allocatedRefund = refundAllocations.reduce(
      (sum, allocation) => sum + Number(allocation.amount),
      0,
    );
    if (Math.abs(allocatedRefund - refundAmount) > 0.009) {
      throw new PosOrderError(
        "VALIDATION_ERROR",
        `Refund allocations must equal the cash-out amount ${money(refundAmount)} ${order.currency} after exchange credit.`,
        422,
      );
    }

    if (exchangeOrder && exchangeCreditAmount > 0) {
      await insertPaymentAdjustment(tx, {
        tenantId,
        branchId: order.branchId,
        customerId: order.customerId,
        orderId: exchangeOrder.id,
        adjustmentType: "correction",
        direction: "credit",
        amount: money(exchangeCreditAmount),
        currency: order.currency,
        idempotencyKey: `${input.data.idempotencyKey}:exchange-credit`,
        reason: `Store credit transferred from return on ${order.id}: ${reason}`,
        actorUserId: input.authContext.userId,
      });
      const balance = await recalculateOrderAfterAdjustment(tx, {
        tenantId,
        order: exchangeOrder,
        actorUserId: input.authContext.userId,
      });
      if (balance.paymentStatus === "paid") {
        await consumeProductInventoryForPaidOrder(tx, {
          tenantId,
          orderId: exchangeOrder.id,
          actorUserId: input.authContext.userId,
        });
      }
    }

    const returnId = createId();
    const refundResults: CreatePosPaymentAdjustmentResponse[] = [];
    for (const [index, allocation] of refundAllocations.entries()) {
      refundResults.push(
        await createPosRefund(
          {
            authContext: input.authContext,
            requestMeta: input.requestMeta,
            data: {
              orderId: order.id,
              originalPaymentId: allocation.originalPaymentId,
              amount: money(Number(allocation.amount)),
              idempotencyKey: `${input.data.idempotencyKey}:refund:${index}`,
              reason,
              salesReturnId: returnId,
              settlementStatus: allocation.settlementReference
                ? "succeeded"
                : undefined,
              settlementReference: allocation.settlementReference,
            },
          },
          tx,
        ),
      );
    }

    const hasPendingRefund = refundResults.some(
      (result) => result.adjustment.status === "pending",
    );
    const now = new Date();
    await tx.insert(salesReturns).values({
      id: returnId,
      tenantId,
      branchId: order.branchId,
      orderId: order.id,
      exchangeOrderId,
      customerId: order.customerId,
      status: hasPendingRefund ? "received" : "completed",
      idempotencyKey: input.data.idempotencyKey,
      reason,
      notes: input.data.notes,
      refundAmount: money(refundAmount),
      returnValueAmount: money(returnValueAmount),
      exchangeCreditAmount: money(exchangeCreditAmount),
      additionalDueAmount: money(additionalDueAmount),
      currency: order.currency,
      receivedAt: now,
      completedAt: hasPendingRefund ? null : now,
      createdBy: input.authContext.userId,
      updatedBy: input.authContext.userId,
      approvedBy: input.authContext.userId,
    });

    let allocatedItemRefund = 0;
    for (const [index, item] of input.data.items.entries()) {
      const source = returnableById.get(item.orderItemId)!;
      const last = index === input.data.items.length - 1;
      const share =
        grossReturned > 0
          ? (returnValueAmount *
              ((Number(source.lineAmount) * Number(item.quantity)) /
                Number(source.purchasedQuantity))) /
            grossReturned
          : 0;
      const itemRefund = last
        ? returnValueAmount - allocatedItemRefund
        : Number(money(share));
      allocatedItemRefund += itemRefund;
      await tx.insert(salesReturnItems).values({
        id: createId(),
        tenantId,
        salesReturnId: returnId,
        orderItemId: item.orderItemId,
        productSkuId: source.productSkuId,
        quantity: item.quantity,
        condition: item.condition,
        disposition: item.disposition,
        refundAmount: money(itemRefund),
        reason: item.reason,
        createdBy: input.authContext.userId,
      });
      if (item.disposition === "restock") {
        await tx
          .insert(inventoryBalances)
          .values({
            id: createId(),
            tenantId,
            branchId: order.branchId,
            productSkuId: source.productSkuId,
            onHandQuantity: item.quantity,
            reservedQuantity: "0",
            currency: order.currency,
            lastMovementAt: now,
            updatedBy: input.authContext.userId,
          })
          .onConflictDoUpdate({
            target: [
              inventoryBalances.tenantId,
              inventoryBalances.branchId,
              inventoryBalances.productSkuId,
            ],
            set: {
              onHandQuantity: sql`${inventoryBalances.onHandQuantity} + ${item.quantity}`,
              lastMovementAt: now,
              updatedAt: now,
              updatedBy: input.authContext.userId,
              version: sql`${inventoryBalances.version} + 1`,
            },
          });
        await tx.insert(inventoryMovements).values({
          id: createId(),
          tenantId,
          branchId: order.branchId,
          productSkuId: source.productSkuId,
          movementType: "sale_return",
          quantityDelta: item.quantity,
          currency: order.currency,
          referenceType: "sales_return",
          referenceId: returnId,
          orderItemId: item.orderItemId,
          terminalId: input.authContext.terminalId,
          idempotencyKey: `${input.data.idempotencyKey}:restock:${index}`,
          reason,
          createdBy: input.authContext.userId,
        });
      }
    }

    await writeAuditLog(tx, {
      tenantId,
      branchId: order.branchId,
      actorUserId: input.authContext.userId,
      eventCategory: "pos_order",
      eventType: exchangeOrderId
        ? "pos.order.products_exchanged"
        : "pos.order.products_returned",
      entityType: "sales_return",
      entityId: returnId,
      reason,
      after: {
        orderId: order.id,
        exchangeOrderId,
        status: hasPendingRefund ? "received" : "completed",
        refundAmount: money(refundAmount),
        returnValueAmount: money(returnValueAmount),
        exchangeCreditAmount: money(exchangeCreditAmount),
        additionalDueAmount: money(additionalDueAmount),
        items: input.data.items,
      },
      metadata: createPosAuditMetadata(input.authContext, {
        orderId: order.id,
        exchangeOrderId,
      }),
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    const [salesReturn] = await loadProductReturns(tx, {
      tenantId,
      orderId: order.id,
    }).then((rows) => rows.filter((row) => row.id === returnId));
    if (!salesReturn)
      throw new Error("Created product return could not be loaded.");
    const responseExchangeOrder = exchangeOrderId
      ? await getPosOrder(
          { authContext: input.authContext, orderId: exchangeOrderId },
          tx,
        )
      : null;
    return { salesReturn, exchangeOrder: responseExchangeOrder };
  });
}
