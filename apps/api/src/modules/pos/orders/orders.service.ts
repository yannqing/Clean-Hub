import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import {
  assertPosContext,
  requirePosBranchId,
} from "../../auth/permission.helper.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { findBranchById } from "../../tenant/branches/branches.repository.js";
import { PosOrderError } from "./orders.errors.js";
import {
  changeOrderStatusRecord,
  countAlreadyOrderedTicketItems,
  countPosOrders,
  createManualOrderItemRecord,
  createOrderRecord,
  createPaymentTransactionRecord,
  findCustomerForOrder,
  findPosOrderAuditSnapshot,
  findPosOrderDetail,
  findPosOrderItemById,
  findPosOrderOverview,
  findPosOrderRaw,
  findPosOrderRawForUpdate,
  findPosOrders,
  findServiceTicketForOrder,
  findTicketItemsForOrder,
  insertManualOrderItems,
  insertOrderItemsFromTicketItems,
  listPaymentTransactions,
  recalculateOrderPaymentState,
  recalculateOrderTotalFromItems,
  softDeleteOrderItemRecord,
  softDeleteOrderRecord,
  sumOrderItemAmounts,
  updateManualOrderItemRecord,
  updateOrderRecord,
} from "./orders.repository.js";
import type {
  ChangePosOrderStatusRequest,
  CreatePosOrderInput,
  CreatePosOrderItemRequest,
  CreatePosOrderRequest,
  CreatePosPaymentRequest,
  PosOrderDetail,
  PosOrderListQuery,
  PosOrderListResponse,
  PosOrderOverview,
  PosOrderOverviewQuery,
  PosOrderStatus,
  PosPaymentTransaction,
  UpdatePosOrderItemRequest,
  UpdatePosOrderRequest,
} from "./orders.types.js";

function requirePosContext(authContext: AuthContext): string {
  assertPosContext(authContext);
  return authContext.tenantId!;
}

function resolveListBranchScope(
  authContext: AuthContext,
): string[] | undefined {
  if (authContext.role === "owner" || authContext.role === "manager") {
    return authContext.branchIds.length > 0
      ? authContext.branchIds
      : undefined;
  }
  return authContext.branchIds;
}

async function requireCustomerActive(
  db: Database,
  input: { tenantId: string; customerId: string },
): Promise<void> {
  const customer = await findCustomerForOrder(db, input);

  if (!customer) {
    throw new PosOrderError(
      "CUSTOMER_NOT_FOUND",
      "Customer profile was not found.",
      404,
    );
  }

  if (customer.status !== "active") {
    throw new PosOrderError(
      "CUSTOMER_DISABLED",
      "Disabled customers cannot be used to create orders.",
      422,
    );
  }
}

function assertOrderCanChangeItems(order: {
  status: PosOrderStatus;
  paidAmount: string;
}): void {
  if (Number(order.paidAmount) > 0 || order.status === "paid") {
    throw new PosOrderError(
      "ORDER_ALREADY_PAID",
      "Paid orders cannot be edited.",
      422,
    );
  }
  if (order.status === "delivered" || order.status === "cancelled") {
    throw new PosOrderError(
      "INVALID_STATUS_TRANSITION",
      "Finalized orders cannot be edited.",
      422,
    );
  }
}

function assertAllowedStatusTransition(
  from: PosOrderStatus,
  to: PosOrderStatus,
): void {
  const allowed: Record<PosOrderStatus, PosOrderStatus[]> = {
    draft: ["received", "cancelled"],
    received: ["cancelled"],
    paid: ["delivered"],
    delivered: [],
    cancelled: [],
  };

  if (!allowed[from].includes(to)) {
    throw new PosOrderError(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition order from "${from}" to "${to}".`,
      422,
    );
  }
}

async function loadOrderOrThrow(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<NonNullable<Awaited<ReturnType<typeof findPosOrderRaw>>>> {
  const order = await findPosOrderRaw(db, input);
  if (!order) {
    throw new PosOrderError("ORDER_NOT_FOUND", "Order was not found.", 404);
  }
  return order;
}

async function lockOrderOrThrow(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<NonNullable<Awaited<ReturnType<typeof findPosOrderRaw>>>> {
  const order = await findPosOrderRawForUpdate(db, input);
  if (!order) {
    throw new PosOrderError("ORDER_NOT_FOUND", "Order was not found.", 404);
  }
  return order;
}

export async function listPosOrders(
  input: { authContext: AuthContext; query: PosOrderListQuery },
  db: Database = getDb(),
): Promise<PosOrderListResponse> {
  const tenantId = requirePosContext(input.authContext);

  if (input.query.branchId) {
    await requirePosBranchId(input.authContext, input.query.branchId, db);
  }

  const listInput = {
    tenantId,
    allowedBranchIds: resolveListBranchScope(input.authContext),
    query: {
      ...input.query,
      limit: input.query.limit ?? 50,
      offset: input.query.offset ?? 0,
    },
  };

  const [data, total] = await Promise.all([
    findPosOrders(db, listInput),
    countPosOrders(db, listInput),
  ]);

  return { data, total };
}

export async function getPosOrder(
  input: { authContext: AuthContext; orderId: string },
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  const tenantId = requirePosContext(input.authContext);
  const order = await findPosOrderDetail(db, {
    tenantId,
    orderId: input.orderId,
  });

  if (!order) {
    throw new PosOrderError("ORDER_NOT_FOUND", "Order was not found.", 404);
  }

  await requirePosBranchId(input.authContext, order.branchId, db);
  return order;
}

export async function createPosOrder(
  input: CreatePosOrderInput,
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  const tenantId = requirePosContext(input.authContext);

  return db.transaction(async (tx) => {
    if (input.data.orderType === "ticket") {
      return createTicketOrder(tx, tenantId, {
        ...input,
        data: input.data,
      });
    }
    return createManualOrder(tx, tenantId, {
      ...input,
      data: input.data,
    });
  });
}

async function createTicketOrder(
  db: Database,
  tenantId: string,
  input: CreatePosOrderInput & { data: Extract<CreatePosOrderRequest, { orderType: "ticket" }> },
): Promise<PosOrderDetail> {
  const ticket = await findServiceTicketForOrder(db, {
    tenantId,
    ticketId: input.data.ticketId,
  });

  if (!ticket) {
    throw new PosOrderError(
      "SERVICE_TICKET_NOT_FOUND",
      "Service ticket was not found.",
      404,
    );
  }

  await requirePosBranchId(input.authContext, ticket.branchId, db);
  await requireCustomerActive(db, { tenantId, customerId: ticket.customerId });

  const items = await findTicketItemsForOrder(db, {
    tenantId,
    ticketId: ticket.id,
    ticketItemIds: input.data.ticketItemIds,
  });

  if (
    items.length === 0 ||
    (input.data.ticketItemIds && items.length !== input.data.ticketItemIds.length)
  ) {
    throw new PosOrderError(
      "SERVICE_TICKET_EMPTY",
      "At least one ticket item is required to create an order.",
      422,
    );
  }

  const alreadyOrdered = await countAlreadyOrderedTicketItems(db, {
    tenantId,
    ticketItemIds: items.map((item) => item.id),
  });

  if (alreadyOrdered > 0) {
    throw new PosOrderError(
      "TICKET_ITEM_ALREADY_ORDERED",
      "One or more ticket items are already linked to an order.",
      409,
    );
  }

  const totalAmount = sumOrderItemAmounts(items);
  const orderId = await createOrderRecord(db, {
    tenantId,
    branchId: ticket.branchId,
    currency: ticket.currency,
    customerId: ticket.customerId,
    orderType: "ticket",
    status: "received",
    totalAmount,
    expireAt: input.data.expireAt,
    notes: input.data.notes,
    actorUserId: input.authContext.userId,
  });

  await insertOrderItemsFromTicketItems(db, {
    tenantId,
    branchId: ticket.branchId,
    customerId: ticket.customerId,
    orderId,
    ticketId: ticket.id,
    items,
    actorUserId: input.authContext.userId,
  });

  const detail = await findPosOrderDetail(db, { tenantId, orderId });
  if (!detail) {
    throw new Error("Created order could not be loaded.");
  }

  await writeOrderAudit(db, input.authContext, input.requestMeta, {
    branchId: detail.branchId,
    eventType: "pos.order.created",
    entityId: detail.id,
    after: detail,
  });

  return detail;
}

async function createManualOrder(
  db: Database,
  tenantId: string,
  input: CreatePosOrderInput & { data: Extract<CreatePosOrderRequest, { orderType: "manual" }> },
): Promise<PosOrderDetail> {
  await requirePosBranchId(input.authContext, input.data.branchId, db);
  await requireCustomerActive(db, {
    tenantId,
    customerId: input.data.customerId,
  });
  const branch = await findBranchById(db, {
    tenantId,
    branchId: input.data.branchId,
  });

  if (!branch) {
    throw new PosOrderError("BRANCH_NOT_ALLOWED", "Branch was not found.", 404);
  }

  const totalAmount = sumOrderItemAmounts(
    input.data.items.map((item) => ({
      lineAmount: (Number(item.quantity) * Number(item.unitAmount)).toFixed(2),
    })),
  );
  const orderId = await createOrderRecord(db, {
    tenantId,
    branchId: input.data.branchId,
    currency: branch.defaultCurrency,
    customerId: input.data.customerId,
    orderType: "manual",
    status: "received",
    totalAmount,
    expireAt: input.data.expireAt,
    notes: input.data.notes,
    actorUserId: input.authContext.userId,
  });

  await insertManualOrderItems(db, {
    tenantId,
    branchId: input.data.branchId,
    customerId: input.data.customerId,
    orderId,
    items: input.data.items,
    actorUserId: input.authContext.userId,
  });

  const detail = await findPosOrderDetail(db, { tenantId, orderId });
  if (!detail) {
    throw new Error("Created order could not be loaded.");
  }

  await writeOrderAudit(db, input.authContext, input.requestMeta, {
    branchId: detail.branchId,
    eventType: "pos.order.created",
    entityId: detail.id,
    after: detail,
  });

  return detail;
}

export async function updatePosOrder(
  authContext: AuthContext,
  orderId: string,
  data: UpdatePosOrderRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  const tenantId = requirePosContext(authContext);

  return db.transaction(async (tx) => {
    const before = await findPosOrderAuditSnapshot(tx, { tenantId, orderId });
    if (!before) {
      throw new PosOrderError("ORDER_NOT_FOUND", "Order was not found.", 404);
    }

    const raw = await loadOrderOrThrow(tx, { tenantId, orderId });
    await requirePosBranchId(authContext, raw.branchId, tx);
    assertOrderCanChangeItems(raw);

    const result = await updateOrderRecord(tx, {
      ...data,
      tenantId,
      orderId,
      actorUserId: authContext.userId,
    });

    if (!result.updated) {
      if (!result.exists) {
        throw new PosOrderError("ORDER_NOT_FOUND", "Order was not found.", 404);
      }
      throw new PosOrderError(
        "VERSION_CONFLICT",
        "Order has been modified. Refresh and try again.",
        409,
      );
    }

    const detail = await findPosOrderDetail(tx, { tenantId, orderId });
    if (!detail) {
      throw new Error("Updated order could not be loaded.");
    }

    await writeOrderAudit(tx, authContext, requestMeta, {
      branchId: detail.branchId,
      eventType: "pos.order.updated",
      entityId: orderId,
      before,
      after: detail,
    });

    return detail;
  });
}

export async function changePosOrderStatus(
  authContext: AuthContext,
  orderId: string,
  data: ChangePosOrderStatusRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  const tenantId = requirePosContext(authContext);

  return db.transaction(async (tx) => {
    const before = await lockOrderOrThrow(tx, { tenantId, orderId });
    await requirePosBranchId(authContext, before.branchId, tx);

    if (data.to === "draft" || data.to === "paid") {
      throw new PosOrderError(
        "INVALID_STATUS_TRANSITION",
        data.to === "paid"
          ? "Paid status is controlled by payment transactions."
          : "Orders cannot transition back to draft.",
        422,
      );
    }

    assertAllowedStatusTransition(before.status, data.to);

    if (data.to === "delivered" && before.paymentStatus !== "paid") {
      throw new PosOrderError(
        "ORDER_NOT_PAID",
        "Order cannot be delivered before it is fully paid.",
        422,
      );
    }

    if (data.to === "cancelled" && Number(before.paidAmount) > 0) {
      throw new PosOrderError(
        "ORDER_ALREADY_PAID",
        "Paid orders cannot be cancelled.",
        422,
      );
    }

    const result = await changeOrderStatusRecord(tx, {
      tenantId,
      orderId,
      actorUserId: authContext.userId,
      to: data.to,
      version: data.version,
    });

    if (!result.updated) {
      if (!result.exists) {
        throw new PosOrderError("ORDER_NOT_FOUND", "Order was not found.", 404);
      }
      throw new PosOrderError(
        "VERSION_CONFLICT",
        "Order has been modified. Refresh and try again.",
        409,
      );
    }

    const detail = await findPosOrderDetail(tx, { tenantId, orderId });
    if (!detail) {
      throw new Error("Updated order could not be loaded.");
    }

    await writeOrderAudit(tx, authContext, requestMeta, {
      branchId: detail.branchId,
      eventType: "pos.order.status_changed",
      entityId: orderId,
      before: { status: before.status },
      after: { status: data.to },
      metadata: data.note ? { note: data.note } : undefined,
    });

    return detail;
  });
}

export async function deletePosOrder(
  authContext: AuthContext,
  orderId: string,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<void> {
  const tenantId = requirePosContext(authContext);

  await db.transaction(async (tx) => {
    const before = await loadOrderOrThrow(tx, { tenantId, orderId });
    await requirePosBranchId(authContext, before.branchId, tx);

    if (
      !["draft", "received", "cancelled"].includes(before.status) ||
      Number(before.paidAmount) > 0
    ) {
      throw new PosOrderError(
        "ORDER_CANNOT_BE_DELETED",
        "Only unpaid draft, received, or cancelled orders can be deleted.",
        422,
      );
    }

    const deleted = await softDeleteOrderRecord(tx, {
      tenantId,
      orderId,
      actorUserId: authContext.userId,
    });

    if (!deleted) {
      throw new PosOrderError("ORDER_NOT_FOUND", "Order was not found.", 404);
    }

    await writeOrderAudit(tx, authContext, requestMeta, {
      branchId: before.branchId,
      eventType: "pos.order.deleted",
      entityId: orderId,
      before,
      after: { deleted: true },
    });
  });
}

export async function listPosOrderPayments(
  authContext: AuthContext,
  orderId: string,
  db: Database = getDb(),
): Promise<{ data: PosPaymentTransaction[] }> {
  const tenantId = requirePosContext(authContext);
  const order = await loadOrderOrThrow(db, { tenantId, orderId });
  await requirePosBranchId(authContext, order.branchId, db);

  return {
    data: await listPaymentTransactions(db, { tenantId, orderId }),
  };
}

export async function createPosOrderPayment(
  authContext: AuthContext,
  orderId: string,
  data: CreatePosPaymentRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  const tenantId = requirePosContext(authContext);

  return db.transaction(async (tx) => {
    const before = await lockOrderOrThrow(tx, { tenantId, orderId });
    await requirePosBranchId(authContext, before.branchId, tx);

    if (data.paymentMethod !== "cash") {
      throw new PosOrderError(
        "PAYMENT_NOT_SUPPORTED",
        "Only cash payments are supported in this milestone.",
        422,
      );
    }

    if (before.status === "cancelled" || before.status === "delivered") {
      throw new PosOrderError(
        "INVALID_STATUS_TRANSITION",
        "Finalized orders cannot accept payments.",
        422,
      );
    }

    if (before.paymentStatus === "paid") {
      throw new PosOrderError(
        "ORDER_ALREADY_PAID",
        "Order is already fully paid.",
        422,
      );
    }

    const nextPaidAmount = Number(before.paidAmount) + Number(data.amount);
    if (nextPaidAmount > Number(before.totalAmount)) {
      throw new PosOrderError(
        "VALIDATION_ERROR",
        "Payment amount exceeds the outstanding balance.",
        422,
      );
    }

    const payment = await createPaymentTransactionRecord(tx, {
      tenantId,
      branchId: before.branchId,
      customerId: before.customerId,
      orderId,
      paymentMethod: data.paymentMethod,
      amount: data.amount,
      currency: before.currency,
      actorUserId: authContext.userId,
    });

    await recalculateOrderPaymentState(tx, {
      tenantId,
      orderId,
      actorUserId: authContext.userId,
    });

    const detail = await findPosOrderDetail(tx, { tenantId, orderId });
    if (!detail) {
      throw new Error("Paid order could not be loaded.");
    }

    await writeOrderAudit(tx, authContext, requestMeta, {
      branchId: before.branchId,
      eventType: "pos.order.payment_created",
      entityId: orderId,
      before: {
        paidAmount: before.paidAmount,
        paymentStatus: before.paymentStatus,
        status: before.status,
      },
      after: {
        paidAmount: detail.paidAmount,
        paymentStatus: detail.paymentStatus,
        status: detail.status,
        paymentId: payment.id,
      },
    });

    return detail;
  });
}

export async function createPosOrderItem(
  authContext: AuthContext,
  orderId: string,
  data: CreatePosOrderItemRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  const tenantId = requirePosContext(authContext);

  return db.transaction(async (tx) => {
    const order = await loadOrderOrThrow(tx, { tenantId, orderId });
    await requirePosBranchId(authContext, order.branchId, tx);
    assertOrderCanChangeItems(order);

    const item = await createManualOrderItemRecord(tx, {
      ...data,
      tenantId,
      branchId: order.branchId,
      customerId: order.customerId,
      orderId,
      actorUserId: authContext.userId,
    });

    await recalculateOrderTotalFromItems(tx, {
      tenantId,
      orderId,
      actorUserId: authContext.userId,
    });
    await recalculateOrderPaymentState(tx, {
      tenantId,
      orderId,
      actorUserId: authContext.userId,
    });

    const detail = await findPosOrderDetail(tx, { tenantId, orderId });
    if (!detail) {
      throw new Error("Updated order could not be loaded.");
    }

    await writeOrderAudit(tx, authContext, requestMeta, {
      branchId: order.branchId,
      eventType: "pos.order.item_added",
      entityId: orderId,
      after: { itemId: item.id },
    });

    return detail;
  });
}

export async function updatePosOrderItem(
  authContext: AuthContext,
  orderId: string,
  itemId: string,
  data: UpdatePosOrderItemRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  const tenantId = requirePosContext(authContext);

  return db.transaction(async (tx) => {
    const order = await loadOrderOrThrow(tx, { tenantId, orderId });
    await requirePosBranchId(authContext, order.branchId, tx);
    assertOrderCanChangeItems(order);

    const result = await updateManualOrderItemRecord(tx, {
      ...data,
      tenantId,
      orderId,
      itemId,
      actorUserId: authContext.userId,
    });

    if (!result.updated) {
      if (!result.exists) {
        throw new PosOrderError(
          "ORDER_ITEM_NOT_FOUND",
          "Order item was not found.",
          404,
        );
      }
      throw new PosOrderError(
        "VERSION_CONFLICT",
        "Order item has been modified. Refresh and try again.",
        409,
      );
    }

    await recalculateOrderTotalFromItems(tx, {
      tenantId,
      orderId,
      actorUserId: authContext.userId,
    });
    await recalculateOrderPaymentState(tx, {
      tenantId,
      orderId,
      actorUserId: authContext.userId,
    });

    const detail = await findPosOrderDetail(tx, { tenantId, orderId });
    if (!detail) {
      throw new Error("Updated order could not be loaded.");
    }

    await writeOrderAudit(tx, authContext, requestMeta, {
      branchId: order.branchId,
      eventType: "pos.order.item_updated",
      entityId: orderId,
      metadata: { itemId },
    });

    return detail;
  });
}

export async function deletePosOrderItem(
  authContext: AuthContext,
  orderId: string,
  itemId: string,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  const tenantId = requirePosContext(authContext);

  return db.transaction(async (tx) => {
    const order = await loadOrderOrThrow(tx, { tenantId, orderId });
    await requirePosBranchId(authContext, order.branchId, tx);
    assertOrderCanChangeItems(order);

    const item = await findPosOrderItemById(tx, { tenantId, orderId, itemId });
    if (!item) {
      throw new PosOrderError(
        "ORDER_ITEM_NOT_FOUND",
        "Order item was not found.",
        404,
      );
    }

    const deleted = await softDeleteOrderItemRecord(tx, {
      tenantId,
      orderId,
      itemId,
      actorUserId: authContext.userId,
    });

    if (!deleted) {
      throw new PosOrderError(
        "ORDER_ITEM_NOT_FOUND",
        "Order item was not found.",
        404,
      );
    }

    await recalculateOrderTotalFromItems(tx, {
      tenantId,
      orderId,
      actorUserId: authContext.userId,
    });
    await recalculateOrderPaymentState(tx, {
      tenantId,
      orderId,
      actorUserId: authContext.userId,
    });

    const detail = await findPosOrderDetail(tx, { tenantId, orderId });
    if (!detail) {
      throw new Error("Updated order could not be loaded.");
    }

    await writeOrderAudit(tx, authContext, requestMeta, {
      branchId: order.branchId,
      eventType: "pos.order.item_deleted",
      entityId: orderId,
      before: item,
    });

    return detail;
  });
}

export async function getPosOrderOverview(
  authContext: AuthContext,
  query: PosOrderOverviewQuery,
  db: Database = getDb(),
): Promise<PosOrderOverview> {
  const tenantId = requirePosContext(authContext);

  if (query.branchId) {
    await requirePosBranchId(authContext, query.branchId, db);
  }

  return findPosOrderOverview(db, {
    tenantId,
    allowedBranchIds: resolveListBranchScope(authContext),
    branchId: query.branchId,
    period: query.period ?? "today",
  });
}

async function writeOrderAudit(
  db: Database,
  authContext: AuthContext,
  requestMeta: AuthRequestMeta | undefined,
  input: {
    branchId: string;
    eventType: string;
    entityId: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await writeAuditLog(db, {
    actorUserId: authContext.userId,
    tenantId: authContext.tenantId,
    branchId: input.branchId,
    eventCategory: "pos_order",
    eventType: input.eventType,
    entityType: "order",
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    metadata: input.metadata,
    ipAddress: requestMeta?.ipAddress,
    userAgent: requestMeta?.userAgent,
  });
}
