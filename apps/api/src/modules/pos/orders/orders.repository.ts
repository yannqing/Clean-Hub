import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  branches,
  customers,
  orderItems,
  orders,
  paymentTransactions,
  serviceTickets,
  tenantSettings,
  ticketItems,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type {
  CreateManualOrderItemRequest,
  PosOrderDetail,
  PosOrderItem,
  PosOrderListInput,
  PosOrderOverview,
  PosOrderOverviewPeriod,
  PosOrderPaymentStatus,
  PosOrderSummary,
  PosOrderType,
  PosMobileMoneyProvider,
  PosPaymentMethod,
  PosPaymentTransaction,
  UpdatePosOrderItemRequest,
  UpdatePosOrderRequest,
} from "./orders.types.js";

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function addMoney(left: string, right: string): string {
  return (Number(left) + Number(right)).toFixed(2);
}

function computeLineAmount(quantity: string, unitAmount: string): string {
  return (Number(quantity) * Number(unitAmount)).toFixed(2);
}

function toOrderItem(row: typeof orderItems.$inferSelect): PosOrderItem {
  return {
    id: row.id,
    orderId: row.orderId,
    ticketId: row.ticketId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    itemName: row.itemName,
    quantity: row.quantity,
    unitAmount: row.unitAmount,
    lineAmount: row.lineAmount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

type OrderJoinedRow = typeof orders.$inferSelect & {
  customerName: string | null;
  itemCount: string | number | null;
};

function toOrderSummary(row: OrderJoinedRow): PosOrderSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    currency: row.currency,
    customerId: row.customerId,
    customerName: row.customerName ?? "",
    orderType: row.orderType,
    status: row.status,
    totalAmount: row.totalAmount,
    paymentStatus: row.paymentStatus,
    paidAmount: row.paidAmount,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    expireAt: row.expireAt ? row.expireAt.toISOString() : null,
    notes: row.notes,
    itemCount: Number(row.itemCount ?? 0),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

function toPaymentTransaction(
  row: typeof paymentTransactions.$inferSelect,
): PosPaymentTransaction {
  return {
    id: row.id,
    orderId: row.orderId,
    paymentMethod: row.paymentMethod,
    amount: row.amount,
    currency: row.currency,
    paymentStatus: row.paymentStatus,
    provider:
      row.gateway === "wave" || row.gateway === "orange_money"
        ? row.gateway
        : null,
    externalReference: row.externalId,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildOrderFilters(input: PosOrderListInput): SQL[] {
  const filters: SQL[] = [
    eq(orders.tenantId, input.tenantId),
    isNull(orders.deletedAt),
  ];

  if (input.allowedBranchIds !== undefined) {
    if (input.allowedBranchIds.length === 0) {
      filters.push(sql`false`);
      return filters;
    }
    filters.push(inArray(orders.branchId, input.allowedBranchIds));
  }

  const { query } = input;
  if (query.branchId) {
    filters.push(eq(orders.branchId, query.branchId));
  }
  if (query.customerId) {
    filters.push(eq(orders.customerId, query.customerId));
  }
  if (query.orderType) {
    filters.push(eq(orders.orderType, query.orderType));
  }
  if (query.paymentStatus) {
    filters.push(eq(orders.paymentStatus, query.paymentStatus));
  }
  if (query.status) {
    const statuses = Array.isArray(query.status) ? query.status : [query.status];
    filters.push(inArray(orders.status, statuses));
  }
  if (query.q) {
    const pattern = `%${escapeLikePattern(query.q)}%`;
    filters.push(
      or(
        sql`${orders.id} ilike ${pattern} escape '\\'`,
        sql`${customers.fullName} ilike ${pattern} escape '\\'`,
      )!,
    );
  }
  if (query.createdAfter) {
    filters.push(gte(orders.createdAt, new Date(query.createdAfter)));
  }
  if (query.createdBefore) {
    filters.push(lt(orders.createdAt, new Date(query.createdBefore)));
  }

  return filters;
}

export async function findPosOrders(
  db: Database,
  input: PosOrderListInput,
): Promise<PosOrderSummary[]> {
  const rows = await db
    .select({
      order: orders,
      customerName: customers.fullName,
      itemCount: sql<number>`(
        select count(*)::int from ${orderItems}
        where ${orderItems.orderId} = ${orders.id}
          and ${orderItems.deletedAt} is null
      )`,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(and(...buildOrderFilters(input)))
    .orderBy(desc(orders.createdAt))
    .limit(input.query.limit ?? 50)
    .offset(input.query.offset ?? 0);

  return rows.map((row) => toOrderSummary({ ...row.order, ...row }));
}

export async function countPosOrders(
  db: Database,
  input: PosOrderListInput,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(and(...buildOrderFilters(input)));

  return rows[0]?.count ?? 0;
}

export async function findPosOrderById(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<PosOrderSummary | null> {
  const rows = await db
    .select({
      order: orders,
      customerName: customers.fullName,
      itemCount: sql<number>`(
        select count(*)::int from ${orderItems}
        where ${orderItems.orderId} = ${orders.id}
          and ${orderItems.deletedAt} is null
      )`,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(
      and(
        eq(orders.id, input.orderId),
        eq(orders.tenantId, input.tenantId),
        isNull(orders.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  return row ? toOrderSummary({ ...row.order, ...row }) : null;
}

export async function findPosOrderDetail(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<PosOrderDetail | null> {
  const summary = await findPosOrderById(db, input);
  if (!summary) {
    return null;
  }

  const itemRows = await db
    .select()
    .from(orderItems)
    .where(
      and(
        eq(orderItems.orderId, input.orderId),
        eq(orderItems.tenantId, input.tenantId),
        isNull(orderItems.deletedAt),
      ),
    )
    .orderBy(orderItems.createdAt);

  return {
    ...summary,
    items: itemRows.map(toOrderItem),
  };
}

export async function findPosOrderRaw(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<(typeof orders.$inferSelect) | null> {
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, input.orderId),
        eq(orders.tenantId, input.tenantId),
        isNull(orders.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findPosOrderRawForUpdate(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<(typeof orders.$inferSelect) | null> {
  const rows = await db
    .select()
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

export async function findPosOrderAuditSnapshot(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<Record<string, unknown> | null> {
  const order = await findPosOrderRaw(db, input);
  if (!order) {
    return null;
  }

  return {
    branchId: order.branchId,
    customerId: order.customerId,
    orderType: order.orderType,
    status: order.status,
    totalAmount: order.totalAmount,
    paymentStatus: order.paymentStatus,
    paidAmount: order.paidAmount,
    expireAt: order.expireAt ? order.expireAt.toISOString() : null,
    notes: order.notes,
    version: order.version,
  };
}

export async function findPosOrderItemById(
  db: Database,
  input: { tenantId: string; orderId: string; itemId: string },
): Promise<PosOrderItem | null> {
  const rows = await db
    .select()
    .from(orderItems)
    .where(
      and(
        eq(orderItems.id, input.itemId),
        eq(orderItems.orderId, input.orderId),
        eq(orderItems.tenantId, input.tenantId),
        isNull(orderItems.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ? toOrderItem(rows[0]) : null;
}

export async function findCustomerForOrder(
  db: Database,
  input: { tenantId: string; customerId: string },
): Promise<{ id: string; status: "active" | "disabled" } | null> {
  const rows = await db
    .select({ id: customers.id, status: customers.status })
    .from(customers)
    .where(
      and(
        eq(customers.id, input.customerId),
        eq(customers.tenantId, input.tenantId),
        isNull(customers.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findServiceTicketForOrder(
  db: Database,
  input: { tenantId: string; ticketId: string },
): Promise<(typeof serviceTickets.$inferSelect) | null> {
  const rows = await db
    .select()
    .from(serviceTickets)
    .where(
      and(
        eq(serviceTickets.id, input.ticketId),
        eq(serviceTickets.tenantId, input.tenantId),
        isNull(serviceTickets.deletedAt),
      ),
    )
    .for("update")
    .limit(1);

  return rows[0] ?? null;
}

export async function findTicketItemsForOrder(
  db: Database,
  input: { tenantId: string; ticketId: string; ticketItemIds?: string[] },
): Promise<(typeof ticketItems.$inferSelect)[]> {
  const filters: SQL[] = [
    eq(ticketItems.ticketId, input.ticketId),
    eq(ticketItems.tenantId, input.tenantId),
    isNull(ticketItems.deletedAt),
  ];

  if (input.ticketItemIds) {
    filters.push(inArray(ticketItems.id, input.ticketItemIds));
  }

  return db
    .select()
    .from(ticketItems)
    .where(and(...filters))
    .orderBy(ticketItems.sortOrder, ticketItems.createdAt);
}

export async function countAlreadyOrderedTicketItems(
  db: Database,
  input: { tenantId: string; ticketItemIds: string[] },
): Promise<number> {
  if (input.ticketItemIds.length === 0) {
    return 0;
  }

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orderItems.tenantId, input.tenantId),
        eq(orderItems.sourceType, "ticket_item"),
        inArray(orderItems.sourceId, input.ticketItemIds),
        isNull(orderItems.deletedAt),
        isNull(orders.deletedAt),
      ),
    );

  return rows[0]?.count ?? 0;
}

export async function createOrderRecord(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    currency: string;
    customerId: string;
    orderType: PosOrderType;
    status: "draft" | "received";
    totalAmount: string;
    expireAt?: string | null;
    notes?: string | null;
    actorUserId: string;
  },
): Promise<string> {
  const orderId = createId();

  await db.insert(orders).values({
    id: orderId,
    tenantId: input.tenantId,
    branchId: input.branchId,
    currency: input.currency,
    customerId: input.customerId,
    orderType: input.orderType,
    status: input.status,
    totalAmount: input.totalAmount,
    paymentStatus: "unpaid",
    paidAmount: "0",
    expireAt: toDate(input.expireAt),
    notes: normalizeNullable(input.notes),
    createdBy: input.actorUserId,
    updatedBy: input.actorUserId,
  });

  return orderId;
}

export async function insertOrderItemsFromTicketItems(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    customerId: string;
    orderId: string;
    ticketId: string;
    items: (typeof ticketItems.$inferSelect)[];
    actorUserId: string;
  },
): Promise<void> {
  if (input.items.length === 0) {
    return;
  }

  await db.insert(orderItems).values(
    input.items.map((item) => ({
      id: createId(),
      orderId: input.orderId,
      ticketId: input.ticketId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      customerId: input.customerId,
      sourceType: "ticket_item" as const,
      sourceId: item.id,
      itemName: item.itemName,
      quantity: String(item.quantity),
      unitAmount: item.unitAmount,
      lineAmount: item.lineAmount,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })),
  );
}

export async function insertManualOrderItems(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    customerId: string;
    orderId: string;
    items: CreateManualOrderItemRequest[];
    actorUserId: string;
  },
): Promise<void> {
  await db.insert(orderItems).values(
    input.items.map((item) => ({
      id: createId(),
      orderId: input.orderId,
      ticketId: null,
      tenantId: input.tenantId,
      branchId: input.branchId,
      customerId: input.customerId,
      sourceType: item.sourceType,
      sourceId: item.sourceId ?? createId(),
      itemName: item.itemName.trim(),
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      lineAmount: computeLineAmount(item.quantity, item.unitAmount),
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })),
  );
}

export function sumOrderItemAmounts(
  items: Array<{ lineAmount: string }>,
): string {
  return items.reduce((total, item) => addMoney(total, item.lineAmount), "0");
}

export async function updateOrderRecord(
  db: Database,
  input: UpdatePosOrderRequest & {
    tenantId: string;
    orderId: string;
    actorUserId: string;
  },
): Promise<{ updated: boolean; exists: boolean }> {
  const updatedRows = await db
    .update(orders)
    .set({
      orderType: input.orderType,
      expireAt:
        input.expireAt === undefined ? sql`expire_at` : toDate(input.expireAt),
      notes:
        input.notes === undefined ? sql`notes` : normalizeNullable(input.notes),
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${orders.version} + 1`,
    })
    .where(
      and(
        eq(orders.id, input.orderId),
        eq(orders.tenantId, input.tenantId),
        eq(orders.version, input.version),
        isNull(orders.deletedAt),
      ),
    )
    .returning({ id: orders.id });

  if (updatedRows[0]) {
    return { updated: true, exists: true };
  }

  const existing = await findPosOrderRaw(db, input);
  return { updated: false, exists: Boolean(existing) };
}

export async function changeOrderStatusRecord(
  db: Database,
  input: {
    tenantId: string;
    orderId: string;
    actorUserId: string;
    to: "received" | "delivered" | "cancelled";
    version: number;
  },
): Promise<{ updated: boolean; exists: boolean }> {
  const updatedRows = await db
    .update(orders)
    .set({
      status: input.to,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${orders.version} + 1`,
    })
    .where(
      and(
        eq(orders.id, input.orderId),
        eq(orders.tenantId, input.tenantId),
        eq(orders.version, input.version),
        isNull(orders.deletedAt),
      ),
    )
    .returning({ id: orders.id });

  if (updatedRows[0]) {
    return { updated: true, exists: true };
  }

  const existing = await findPosOrderRaw(db, input);
  return { updated: false, exists: Boolean(existing) };
}

export async function softDeleteOrderRecord(
  db: Database,
  input: { tenantId: string; orderId: string; actorUserId: string },
): Promise<boolean> {
  const updatedRows = await db
    .update(orders)
    .set({
      deletedAt: new Date(),
      deletedBy: input.actorUserId,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${orders.version} + 1`,
    })
    .where(
      and(
        eq(orders.id, input.orderId),
        eq(orders.tenantId, input.tenantId),
        isNull(orders.deletedAt),
      ),
    )
    .returning({ id: orders.id });

  return Boolean(updatedRows[0]);
}

export async function listPaymentTransactions(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<PosPaymentTransaction[]> {
  const rows = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.tenantId, input.tenantId),
        eq(paymentTransactions.orderId, input.orderId),
        isNull(paymentTransactions.deletedAt),
      ),
    )
    .orderBy(desc(paymentTransactions.createdAt));

  return rows.map(toPaymentTransaction);
}

export async function createPaymentTransactionRecord(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    customerId: string;
    orderId: string;
    paymentMethod: PosPaymentMethod;
    amount: string;
    currency: string;
    actorUserId: string;
    provider?: PosMobileMoneyProvider;
    externalReference?: string;
    idempotencyKey?: string;
  },
): Promise<PosPaymentTransaction> {
  const paymentId = createId();
  const isCash = input.paymentMethod === "cash";
  const paidAt = isCash ? new Date() : null;

  await db.insert(paymentTransactions).values({
    id: paymentId,
    tenantId: input.tenantId,
    branchId: input.branchId,
    customerId: input.customerId,
    orderId: input.orderId,
    paymentMethod: input.paymentMethod,
    amount: input.amount,
    currency: input.currency,
    paymentStatus: isCash ? "paid" : "pending",
    gateway: input.provider,
    externalId: input.externalReference,
    idempotencyKey: input.idempotencyKey,
    paidAt,
    createdBy: input.actorUserId,
    updatedBy: input.actorUserId,
  });

  const rows = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.id, paymentId))
    .limit(1);

  if (!rows[0]) {
    throw new Error("Created payment transaction could not be loaded.");
  }

  return toPaymentTransaction(rows[0]);
}

export async function findPaymentTransactionByIdempotencyKey(
  db: Database,
  input: { tenantId: string; idempotencyKey: string },
): Promise<PosPaymentTransaction | null> {
  const rows = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.tenantId, input.tenantId),
        eq(paymentTransactions.idempotencyKey, input.idempotencyKey),
        isNull(paymentTransactions.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ? toPaymentTransaction(rows[0]) : null;
}

export async function findPaymentTransactionByProviderReference(
  db: Database,
  input: {
    tenantId: string;
    provider: PosMobileMoneyProvider;
    externalReference: string;
  },
): Promise<PosPaymentTransaction | null> {
  const rows = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.tenantId, input.tenantId),
        eq(paymentTransactions.gateway, input.provider),
        eq(paymentTransactions.externalId, input.externalReference),
        isNull(paymentTransactions.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ? toPaymentTransaction(rows[0]) : null;
}

export async function findPendingManualPaymentForOrder(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<PosPaymentTransaction | null> {
  const rows = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.tenantId, input.tenantId),
        eq(paymentTransactions.orderId, input.orderId),
        eq(paymentTransactions.paymentMethod, "app"),
        eq(paymentTransactions.paymentStatus, "pending"),
        inArray(paymentTransactions.gateway, ["wave", "orange_money"]),
        isNull(paymentTransactions.deletedAt),
      ),
    )
    .orderBy(desc(paymentTransactions.createdAt))
    .limit(1);

  return rows[0] ? toPaymentTransaction(rows[0]) : null;
}

export async function findPaymentTransactionForUpdate(
  db: Database,
  input: { tenantId: string; orderId: string; paymentId: string },
): Promise<PosPaymentTransaction | null> {
  const rows = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.id, input.paymentId),
        eq(paymentTransactions.tenantId, input.tenantId),
        eq(paymentTransactions.orderId, input.orderId),
        isNull(paymentTransactions.deletedAt),
      ),
    )
    .for("update")
    .limit(1);

  return rows[0] ? toPaymentTransaction(rows[0]) : null;
}

export async function resolveManualPaymentTransaction(
  db: Database,
  input: {
    tenantId: string;
    paymentId: string;
    status: "paid" | "failed";
    actorUserId: string;
  },
): Promise<PosPaymentTransaction | null> {
  const now = new Date();
  const rows = await db
    .update(paymentTransactions)
    .set({
      paymentStatus: input.status,
      paidAt: input.status === "paid" ? now : null,
      updatedAt: now,
      updatedBy: input.actorUserId,
      version: sql`${paymentTransactions.version} + 1`,
    })
    .where(
      and(
        eq(paymentTransactions.id, input.paymentId),
        eq(paymentTransactions.tenantId, input.tenantId),
        eq(paymentTransactions.paymentStatus, "pending"),
        isNull(paymentTransactions.deletedAt),
      ),
    )
    .returning();

  return rows[0] ? toPaymentTransaction(rows[0]) : null;
}

export async function recalculateOrderPaymentState(
  db: Database,
  input: { tenantId: string; orderId: string; actorUserId: string },
): Promise<void> {
  const order = await findPosOrderRaw(db, input);
  if (!order) {
    return;
  }

  const rows = await db
    .select({
      paidAmount: sql<string>`coalesce(sum(${paymentTransactions.amount}), 0)`,
      // Raw sql fragments bypass drizzle's column mapping, so the driver
      // returns timestamptz as a string — convert before writing back.
      paidAt: sql<string | null>`max(${paymentTransactions.paidAt})`,
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

  const paidAmount = Number(rows[0]?.paidAmount ?? "0");
  const totalAmount = Number(order.totalAmount);
  const paymentStatus: PosOrderPaymentStatus =
    paidAmount <= 0
      ? "unpaid"
      : paidAmount < totalAmount
        ? "partial"
        : "paid";
  const nextStatus =
    paymentStatus === "paid" && order.status !== "delivered"
      ? "paid"
      : order.status;

  await db
    .update(orders)
    .set({
      paidAmount: paidAmount.toFixed(2),
      paidAt: rows[0]?.paidAt ? new Date(rows[0].paidAt) : null,
      paymentStatus,
      status: nextStatus,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${orders.version} + 1`,
    })
    .where(
      and(
        eq(orders.id, input.orderId),
        eq(orders.tenantId, input.tenantId),
        isNull(orders.deletedAt),
      ),
    );
}

export async function createManualOrderItemRecord(
  db: Database,
  input: CreateManualOrderItemRequest & {
    tenantId: string;
    branchId: string;
    customerId: string;
    orderId: string;
    actorUserId: string;
  },
): Promise<PosOrderItem> {
  const itemId = createId();

  await db.insert(orderItems).values({
    id: itemId,
    orderId: input.orderId,
    ticketId: null,
    tenantId: input.tenantId,
    branchId: input.branchId,
    customerId: input.customerId,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? createId(),
    itemName: input.itemName.trim(),
    quantity: input.quantity,
    unitAmount: input.unitAmount,
    lineAmount: computeLineAmount(input.quantity, input.unitAmount),
    createdBy: input.actorUserId,
    updatedBy: input.actorUserId,
  });

  const item = await findPosOrderItemById(db, {
    tenantId: input.tenantId,
    orderId: input.orderId,
    itemId,
  });
  if (!item) {
    throw new Error("Created order item could not be loaded.");
  }
  return item;
}

export async function updateManualOrderItemRecord(
  db: Database,
  input: UpdatePosOrderItemRequest & {
    tenantId: string;
    orderId: string;
    itemId: string;
    actorUserId: string;
  },
): Promise<{ updated: boolean; exists: boolean }> {
  const existing = await findPosOrderItemById(db, input);
  if (!existing) {
    return { updated: false, exists: false };
  }

  const quantity = input.quantity ?? existing.quantity;
  const unitAmount = input.unitAmount ?? existing.unitAmount;

  const updatedRows = await db
    .update(orderItems)
    .set({
      itemName: input.itemName?.trim() ?? existing.itemName,
      quantity,
      unitAmount,
      lineAmount: computeLineAmount(quantity, unitAmount),
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${orderItems.version} + 1`,
    })
    .where(
      and(
        eq(orderItems.id, input.itemId),
        eq(orderItems.orderId, input.orderId),
        eq(orderItems.tenantId, input.tenantId),
        eq(orderItems.version, input.version),
        isNull(orderItems.deletedAt),
      ),
    )
    .returning({ id: orderItems.id });

  if (updatedRows[0]) {
    return { updated: true, exists: true };
  }

  return { updated: false, exists: true };
}

export async function softDeleteOrderItemRecord(
  db: Database,
  input: {
    tenantId: string;
    orderId: string;
    itemId: string;
    actorUserId: string;
  },
): Promise<boolean> {
  const updatedRows = await db
    .update(orderItems)
    .set({
      deletedAt: new Date(),
      deletedBy: input.actorUserId,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${orderItems.version} + 1`,
    })
    .where(
      and(
        eq(orderItems.id, input.itemId),
        eq(orderItems.orderId, input.orderId),
        eq(orderItems.tenantId, input.tenantId),
        isNull(orderItems.deletedAt),
      ),
    )
    .returning({ id: orderItems.id });

  return Boolean(updatedRows[0]);
}

export async function recalculateOrderTotalFromItems(
  db: Database,
  input: { tenantId: string; orderId: string; actorUserId: string },
): Promise<void> {
  const rows = await db
    .select({
      totalAmount: sql<string>`coalesce(sum(${orderItems.lineAmount}), 0)`,
    })
    .from(orderItems)
    .where(
      and(
        eq(orderItems.tenantId, input.tenantId),
        eq(orderItems.orderId, input.orderId),
        isNull(orderItems.deletedAt),
      ),
    );

  await db
    .update(orders)
    .set({
      totalAmount: Number(rows[0]?.totalAmount ?? "0").toFixed(2),
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${orders.version} + 1`,
    })
    .where(
      and(
        eq(orders.id, input.orderId),
        eq(orders.tenantId, input.tenantId),
        isNull(orders.deletedAt),
      ),
    );
}

function getPeriodStart(period: PosOrderOverviewPeriod): Date | null {
  if (period === "all") {
    return null;
  }

  const now = new Date();
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  if (period === "today") {
    return new Date(today);
  }
  if (period === "week") {
    return new Date(today - 6 * 24 * 60 * 60 * 1000);
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function findPosOrderOverview(
  db: Database,
  input: {
    tenantId: string;
    allowedBranchIds?: string[];
    branchId?: string;
    period: PosOrderOverviewPeriod;
  },
): Promise<PosOrderOverview> {
  const effectiveBranchId =
    input.branchId ??
    (input.allowedBranchIds?.length === 1 ? input.allowedBranchIds[0] : undefined);
  const currencyRows = effectiveBranchId
    ? await db
        .select({ currency: branches.defaultCurrency })
        .from(branches)
        .where(
          and(
            eq(branches.id, effectiveBranchId),
            eq(branches.tenantId, input.tenantId),
            isNull(branches.deletedAt),
          ),
        )
        .limit(1)
    : await db
        .select({ currency: tenantSettings.defaultCurrency })
        .from(tenantSettings)
        .where(eq(tenantSettings.tenantId, input.tenantId))
        .limit(1);
  const currency = currencyRows[0]?.currency ?? "XOF";
  const start = getPeriodStart(input.period);
  const orderFilters: SQL[] = [
    eq(orders.tenantId, input.tenantId),
    isNull(orders.deletedAt),
  ];
  const paymentFilters: SQL[] = [
    eq(paymentTransactions.tenantId, input.tenantId),
    eq(paymentTransactions.paymentStatus, "paid"),
    isNull(paymentTransactions.deletedAt),
  ];

  if (start) {
    orderFilters.push(gte(orders.createdAt, start));
    paymentFilters.push(gte(paymentTransactions.paidAt, start));
  }

  if (input.allowedBranchIds !== undefined) {
    if (input.allowedBranchIds.length === 0) {
      return {
        tenantId: input.tenantId,
        branchId: input.branchId ?? null,
        currency,
        period: input.period,
        orderCount: 0,
        totalAmount: "0.00",
        paidAmount: "0.00",
        unpaidCount: 0,
        partialCount: 0,
        paidCount: 0,
        deliveredCount: 0,
        cancelledCount: 0,
        paymentMethods: [],
      };
    }
    orderFilters.push(inArray(orders.branchId, input.allowedBranchIds));
    paymentFilters.push(
      inArray(paymentTransactions.branchId, input.allowedBranchIds),
    );
  }

  if (input.branchId) {
    orderFilters.push(eq(orders.branchId, input.branchId));
    paymentFilters.push(eq(paymentTransactions.branchId, input.branchId));
  }

  const totalsRows = await db
    .select({
      orderCount: sql<number>`count(*)::int`,
      totalAmount: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
      unpaidCount: sql<number>`count(*) filter (where ${orders.paymentStatus} = 'unpaid')::int`,
      partialCount: sql<number>`count(*) filter (where ${orders.paymentStatus} = 'partial')::int`,
      paidCount: sql<number>`count(*) filter (where ${orders.paymentStatus} = 'paid')::int`,
      deliveredCount: sql<number>`count(*) filter (where ${orders.status} = 'delivered')::int`,
      cancelledCount: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')::int`,
    })
    .from(orders)
    .where(and(...orderFilters));

  const paidRows = await db
    .select({
      paidAmount: sql<string>`coalesce(sum(${paymentTransactions.amount}), 0)`,
    })
    .from(paymentTransactions)
    .where(and(...paymentFilters));

  const methodRows = await db
    .select({
      method: paymentTransactions.paymentMethod,
      provider: paymentTransactions.gateway,
      amount: sql<string>`coalesce(sum(${paymentTransactions.amount}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(paymentTransactions)
    .where(and(...paymentFilters))
    .groupBy(paymentTransactions.paymentMethod, paymentTransactions.gateway);

  const totals = totalsRows[0];

  return {
    tenantId: input.tenantId,
    branchId: input.branchId ?? null,
    currency,
    period: input.period,
    orderCount: totals?.orderCount ?? 0,
    totalAmount: Number(totals?.totalAmount ?? "0").toFixed(2),
    paidAmount: Number(paidRows[0]?.paidAmount ?? "0").toFixed(2),
    unpaidCount: totals?.unpaidCount ?? 0,
    partialCount: totals?.partialCount ?? 0,
    paidCount: totals?.paidCount ?? 0,
    deliveredCount: totals?.deliveredCount ?? 0,
    cancelledCount: totals?.cancelledCount ?? 0,
    paymentMethods: methodRows.map((row) => ({
      method: row.method,
      provider:
        row.provider === "wave" || row.provider === "orange_money"
          ? row.provider
          : null,
      amount: Number(row.amount).toFixed(2),
      count: row.count,
    })),
  };
}
