import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { findBranchById } from "../../tenant/branches/branches.repository.js";
import {
  authorizePosSensitiveOperation,
  requirePosBranchAccess,
  requirePosTenantId,
  resolvePosBranchScope,
} from "../access-control.helper.js";
import { PosOrderError } from "./orders.errors.js";
import {
  changeOrderStatusRecord,
  calculatePosOrderItemLineAmount,
  countAlreadyOrderedTicketItems,
  countPosOrders,
  createManualOrderItemRecord,
  createOrderRecord,
  createPaymentTransactionRecord,
  findCustomerForOrder,
  findPaymentTransactionByIdempotencyKey,
  findPaymentTransactionByProviderReference,
  findPaymentTransactionForUpdate,
  findPendingManualPaymentForOrder,
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
  resolveManualPaymentTransaction,
  softDeleteOrderItemRecord,
  softDeleteOrderRecord,
  sumOrderItemAmounts,
  updateManualOrderItemRecord,
  updateOrderRecord,
  type ResolvedPosOrderItemInput,
} from "./orders.repository.js";
import { findPosCatalogServiceById } from "../catalog/catalog.repository.js";
import type {
  ChangePosOrderStatusRequest,
  CreatePosOrderInput,
  CreatePosOrderItemRequest,
  CreatePosOrderRequest,
  CreatePosPaymentRequest,
  CreatePosPaymentResponse,
  DeletePosOrderItemRequest,
  DeletePosOrderRequest,
  PosOrderDetail,
  PosOrderItem,
  PosOrderListQuery,
  PosOrderListResponse,
  PosOrderOverview,
  PosOrderOverviewQuery,
  PosOrderStatus,
  PosPaymentTransaction,
  ResolvePosPaymentRequest,
  UpdatePosOrderItemRequest,
  UpdatePosOrderRequest,
} from "./orders.types.js";

function requireManualPaymentConfirmationRole(authContext: AuthContext): void {
  if (authContext.role !== "owner" && authContext.role !== "manager") {
    throw new PosOrderError(
      "PAYMENT_CONFIRMATION_FORBIDDEN",
      "Only an owner or manager can resolve a manual mobile payment.",
      403,
    );
  }
}

export function paymentIntentMatches(
  payment: PosPaymentTransaction,
  orderId: string,
  data: CreatePosPaymentRequest,
): boolean {
  return (
    payment.orderId === orderId &&
    payment.paymentMethod === data.paymentMethod &&
    Number(payment.amount) === Number(data.amount) &&
    (data.paymentMethod === "cash" ||
      (payment.provider === data.provider &&
        payment.externalReference === data.externalReference))
  );
}

async function loadIdempotentPaymentResult(
  db: Database,
  input: {
    tenantId: string;
    orderId: string;
    payment: PosPaymentTransaction;
    data: CreatePosPaymentRequest;
  },
): Promise<CreatePosPaymentResponse> {
  if (!paymentIntentMatches(input.payment, input.orderId, input.data)) {
    throw new PosOrderError(
      "PAYMENT_REFERENCE_CONFLICT",
      "The idempotency key or provider reference is already used by another payment.",
      409,
    );
  }

  const detail = await findPosOrderDetail(db, {
    tenantId: input.tenantId,
    orderId: input.orderId,
  });
  if (!detail) {
    throw new Error("Idempotent payment order could not be loaded.");
  }
  return { order: detail, payment: input.payment, idempotent: true };
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

function moneyEquals(left: string, right: string): boolean {
  return Number(left).toFixed(2) === Number(right).toFixed(2);
}

function resolveNullableField(
  submitted: string | null | undefined,
  existing: string | null | undefined,
): string | null {
  if (submitted === undefined) {
    return existing ?? null;
  }
  const trimmed = submitted?.trim();
  return trimmed ? trimmed : null;
}

async function resolveOrderItemPricing(
  db: Database,
  input: {
    authContext: AuthContext;
    tenantId: string;
    currency: string;
    data: CreatePosOrderItemRequest | UpdatePosOrderItemRequest;
    existing?: PosOrderItem;
  },
): Promise<ResolvedPosOrderItemInput & { overrideReason?: string }> {
  const serviceId = input.data.serviceId ?? input.existing?.serviceId;
  if (!serviceId) {
    throw new PosOrderError(
      "VALIDATION_ERROR",
      "A catalog service is required for every order item.",
      422,
    );
  }

  const service = await findPosCatalogServiceById(db, {
    tenantId: input.tenantId,
    serviceId,
  });
  if (!service) {
    throw new PosOrderError(
      "VALIDATION_ERROR",
      "The selected catalog service is not active or has no active price.",
      422,
    );
  }
  if (service.currency !== input.currency) {
    throw new PosOrderError(
      "VALIDATION_ERROR",
      "The selected service price currency does not match the order currency.",
      422,
    );
  }

  const serviceChanged =
    !input.existing || serviceId !== input.existing.serviceId;
  const standardUnitAmount =
    serviceChanged || !input.existing
      ? service.amount
      : input.existing.standardUnitAmount;
  const chargedUnitAmount =
    input.data.chargedUnitAmount ??
    (serviceChanged || !input.existing
      ? standardUnitAmount
      : input.existing.chargedUnitAmount);
  const priceWasSubmitted =
    input.data.chargedUnitAmount !== undefined || serviceChanged;
  const overrideReason =
    priceWasSubmitted && !moneyEquals(chargedUnitAmount, standardUnitAmount)
      ? authorizePosSensitiveOperation(
          input.authContext,
          "price_override",
          input.data.overrideReason,
        )
      : undefined;

  const operational = {
    itemColor: resolveNullableField(
      input.data.itemColor,
      input.existing?.itemColor,
    ),
    defectNotes: resolveNullableField(
      input.data.defectNotes,
      input.existing?.defectNotes,
    ),
    specialRequest: resolveNullableField(
      input.data.specialRequest,
      input.existing?.specialRequest,
    ),
    itemIdentifier: resolveNullableField(
      input.data.itemIdentifier,
      input.existing?.itemIdentifier,
    ),
  };

  if (service.pricingUnit === "per_kg") {
    const weight = input.data.weight ?? input.existing?.weight;
    if (!weight || Number(weight) <= 0) {
      throw new PosOrderError(
        "VALIDATION_ERROR",
        "Weight is required for a per-kilogram service.",
        422,
      );
    }
    return {
      serviceId,
      itemName: service.name,
      pricingUnit: service.pricingUnit,
      standardUnitAmount,
      chargedUnitAmount,
      quantity: "1",
      weight,
      bagCount: input.data.bagCount ?? input.existing?.bagCount ?? 1,
      ...operational,
      overrideReason,
    };
  }

  const quantity = input.data.quantity ?? input.existing?.quantity;
  if (
    !quantity ||
    !Number.isInteger(Number(quantity)) ||
    Number(quantity) < 1
  ) {
    throw new PosOrderError(
      "VALIDATION_ERROR",
      "A positive whole-number quantity is required for a per-item service.",
      422,
    );
  }
  return {
    serviceId,
    itemName: service.name,
    pricingUnit: service.pricingUnit,
    standardUnitAmount,
    chargedUnitAmount,
    quantity,
    weight: null,
    bagCount: null,
    ...operational,
    overrideReason,
  };
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
  const tenantId = requirePosTenantId(input.authContext);

  if (input.query.branchId) {
    requirePosBranchAccess(input.authContext, input.query.branchId);
  }

  const listInput = {
    tenantId,
    allowedBranchIds: resolvePosBranchScope(input.authContext),
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
  const tenantId = requirePosTenantId(input.authContext);
  const order = await findPosOrderDetail(db, {
    tenantId,
    orderId: input.orderId,
  });

  if (!order) {
    throw new PosOrderError("ORDER_NOT_FOUND", "Order was not found.", 404);
  }

  requirePosBranchAccess(input.authContext, order.branchId);
  return order;
}

export async function createPosOrder(
  input: CreatePosOrderInput,
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  const tenantId = requirePosTenantId(input.authContext);

  if (input.data.id) {
    const existing = await findPosOrderDetail(db, {
      tenantId,
      orderId: input.data.id,
    });
    if (existing) {
      requirePosBranchAccess(input.authContext, existing.branchId);
      return existing;
    }
  }

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
  input: CreatePosOrderInput & {
    data: Extract<CreatePosOrderRequest, { orderType: "ticket" }>;
  },
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

  requirePosBranchAccess(input.authContext, ticket.branchId);
  await requireCustomerActive(db, { tenantId, customerId: ticket.customerId });

  const items = await findTicketItemsForOrder(db, {
    tenantId,
    ticketId: ticket.id,
    ticketItemIds: input.data.ticketItemIds,
  });

  if (
    items.length === 0 ||
    (input.data.ticketItemIds &&
      items.length !== input.data.ticketItemIds.length)
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
    id: input.data.id,
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
  input: CreatePosOrderInput & {
    data: Extract<CreatePosOrderRequest, { orderType: "manual" }>;
  },
): Promise<PosOrderDetail> {
  requirePosBranchAccess(input.authContext, input.data.branchId);
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

  const resolvedItems: Array<
    ResolvedPosOrderItemInput & { overrideReason?: string }
  > = [];
  for (const item of input.data.items) {
    resolvedItems.push(
      await resolveOrderItemPricing(db, {
        authContext: input.authContext,
        tenantId,
        currency: branch.defaultCurrency,
        data: item,
      }),
    );
  }
  const totalAmount = sumOrderItemAmounts(
    resolvedItems.map((item) => ({
      lineAmount: calculatePosOrderItemLineAmount(item),
    })),
  );
  const orderId = await createOrderRecord(db, {
    id: input.data.id,
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
    items: resolvedItems,
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
    reason:
      resolvedItems
        .map((item) => item.overrideReason)
        .filter((reason): reason is string => Boolean(reason))
        .join(" | ") || undefined,
    after: detail,
    metadata: {
      priceOverrides: resolvedItems
        .filter((item) => item.overrideReason)
        .map((item) => ({
          serviceId: item.serviceId,
          standardUnitAmount: item.standardUnitAmount,
          chargedUnitAmount: item.chargedUnitAmount,
          reason: item.overrideReason,
        })),
    },
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
  const tenantId = requirePosTenantId(authContext);

  return db.transaction(async (tx) => {
    const before = await findPosOrderAuditSnapshot(tx, { tenantId, orderId });
    if (!before) {
      throw new PosOrderError("ORDER_NOT_FOUND", "Order was not found.", 404);
    }

    const raw = await loadOrderOrThrow(tx, { tenantId, orderId });
    requirePosBranchAccess(authContext, raw.branchId);
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
  const tenantId = requirePosTenantId(authContext);
  const sensitiveReason =
    data.to === "cancelled"
      ? authorizePosSensitiveOperation(authContext, "cancel", data.reason)
      : undefined;

  return db.transaction(async (tx) => {
    const before = await lockOrderOrThrow(tx, { tenantId, orderId });
    requirePosBranchAccess(authContext, before.branchId);

    if (data.to === "draft" || data.to === "paid") {
      throw new PosOrderError(
        "INVALID_STATUS_TRANSITION",
        data.to === "paid"
          ? "Paid status is controlled by payment transactions."
          : "Orders cannot transition back to draft.",
        422,
      );
    }

    if (before.status === data.to) {
      const detail = await findPosOrderDetail(tx, { tenantId, orderId });
      if (!detail) {
        throw new Error("Order could not be loaded for status replay.");
      }
      return detail;
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
      reason: sensitiveReason,
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
  data: DeletePosOrderRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<void> {
  const tenantId = requirePosTenantId(authContext);
  const reason = authorizePosSensitiveOperation(
    authContext,
    "delete",
    data.reason,
  );

  await db.transaction(async (tx) => {
    const before = await loadOrderOrThrow(tx, { tenantId, orderId });
    requirePosBranchAccess(authContext, before.branchId);

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
      reason,
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
  const tenantId = requirePosTenantId(authContext);
  const order = await loadOrderOrThrow(db, { tenantId, orderId });
  requirePosBranchAccess(authContext, order.branchId);

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
): Promise<CreatePosPaymentResponse> {
  const tenantId = requirePosTenantId(authContext);

  return db.transaction(async (tx) => {
    const before = await lockOrderOrThrow(tx, { tenantId, orderId });
    requirePosBranchAccess(authContext, before.branchId);

    const existingIdempotent = await findPaymentTransactionByIdempotencyKey(
      tx,
      { tenantId, idempotencyKey: data.idempotencyKey },
    );
    if (existingIdempotent) {
      return loadIdempotentPaymentResult(tx, {
        tenantId,
        orderId,
        payment: existingIdempotent,
        data,
      });
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

    if (data.paymentMethod === "app") {
      const existingReference = await findPaymentTransactionByProviderReference(
        tx,
        {
          tenantId,
          provider: data.provider,
          externalReference: data.externalReference,
        },
      );
      if (existingReference) {
        return loadIdempotentPaymentResult(tx, {
          tenantId,
          orderId,
          payment: existingReference,
          data,
        });
      }
    }

    const pending = await findPendingManualPaymentForOrder(tx, {
      tenantId,
      orderId,
    });
    if (pending) {
      throw new PosOrderError(
        "PAYMENT_ALREADY_PENDING",
        "Resolve the pending mobile payment before recording another payment.",
        409,
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

    const createdPayment = await createPaymentTransactionRecord(tx, {
      tenantId,
      branchId: before.branchId,
      customerId: before.customerId,
      orderId,
      paymentMethod: data.paymentMethod,
      amount: data.amount,
      currency: before.currency,
      actorUserId: authContext.userId,
      provider: data.paymentMethod === "app" ? data.provider : undefined,
      externalReference:
        data.paymentMethod === "app" ? data.externalReference : undefined,
      idempotencyKey: data.idempotencyKey,
    });

    const payment =
      createdPayment ??
      (await findPaymentTransactionByIdempotencyKey(tx, {
        tenantId,
        idempotencyKey: data.idempotencyKey,
      })) ??
      (data.paymentMethod === "app"
        ? await findPaymentTransactionByProviderReference(tx, {
            tenantId,
            provider: data.provider,
            externalReference: data.externalReference,
          })
        : null);

    if (!payment) {
      throw new PosOrderError(
        "PAYMENT_REFERENCE_CONFLICT",
        "The payment could not be created because its reference is already in use.",
        409,
      );
    }

    if (!createdPayment) {
      return loadIdempotentPaymentResult(tx, {
        tenantId,
        orderId,
        payment,
        data,
      });
    }

    if (payment.paymentStatus === "paid") {
      await recalculateOrderPaymentState(tx, {
        tenantId,
        orderId,
        actorUserId: authContext.userId,
      });
    }

    const detail = await findPosOrderDetail(tx, { tenantId, orderId });
    if (!detail) {
      throw new Error("Paid order could not be loaded.");
    }

    await writeOrderAudit(tx, authContext, requestMeta, {
      branchId: before.branchId,
      eventType:
        payment.paymentStatus === "pending"
          ? "pos.order.mobile_payment_recorded"
          : "pos.order.payment_created",
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
        paymentMethod: payment.paymentMethod,
        provider: payment.provider,
        externalReference: payment.externalReference,
        transactionStatus: payment.paymentStatus,
      },
    });

    return { order: detail, payment, idempotent: false };
  });
}

async function resolvePosManualPayment(
  authContext: AuthContext,
  orderId: string,
  paymentId: string,
  data: ResolvePosPaymentRequest,
  status: "paid" | "failed",
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  const tenantId = requirePosTenantId(authContext);
  requireManualPaymentConfirmationRole(authContext);

  return db.transaction(async (tx) => {
    const before = await lockOrderOrThrow(tx, { tenantId, orderId });
    requirePosBranchAccess(authContext, before.branchId);
    const payment = await findPaymentTransactionForUpdate(tx, {
      tenantId,
      orderId,
      paymentId,
    });

    if (!payment) {
      throw new PosOrderError(
        "PAYMENT_NOT_FOUND",
        "Payment transaction was not found.",
        404,
      );
    }
    if (
      payment.paymentMethod !== "app" ||
      (payment.provider !== "wave" && payment.provider !== "orange_money")
    ) {
      throw new PosOrderError(
        "PAYMENT_NOT_SUPPORTED",
        "Only manual Wave or Orange Money payments can be resolved here.",
        422,
      );
    }
    if (payment.paymentStatus !== "pending") {
      throw new PosOrderError(
        "PAYMENT_ALREADY_RESOLVED",
        "This payment has already been resolved.",
        409,
      );
    }

    if (status === "paid") {
      const outstanding =
        Number(before.totalAmount) - Number(before.paidAmount);
      if (Number(payment.amount) > outstanding) {
        throw new PosOrderError(
          "VALIDATION_ERROR",
          "Payment amount exceeds the current outstanding balance.",
          422,
        );
      }
    }

    const resolved = await resolveManualPaymentTransaction(tx, {
      tenantId,
      paymentId,
      status,
      actorUserId: authContext.userId,
    });
    if (!resolved) {
      throw new PosOrderError(
        "PAYMENT_ALREADY_RESOLVED",
        "This payment has already been resolved.",
        409,
      );
    }

    if (status === "paid") {
      await recalculateOrderPaymentState(tx, {
        tenantId,
        orderId,
        actorUserId: authContext.userId,
      });
    }

    const detail = await findPosOrderDetail(tx, { tenantId, orderId });
    if (!detail) {
      throw new Error("Resolved payment order could not be loaded.");
    }

    await writeOrderAudit(tx, authContext, requestMeta, {
      branchId: before.branchId,
      eventType:
        status === "paid"
          ? "pos.order.mobile_payment_confirmed"
          : "pos.order.mobile_payment_failed",
      entityId: orderId,
      reason: data.reason,
      before: {
        paidAmount: before.paidAmount,
        paymentStatus: before.paymentStatus,
        status: before.status,
        paymentId,
        transactionStatus: payment.paymentStatus,
      },
      after: {
        paidAmount: detail.paidAmount,
        paymentStatus: detail.paymentStatus,
        status: detail.status,
        paymentId,
        provider: payment.provider,
        externalReference: payment.externalReference,
        transactionStatus: resolved.paymentStatus,
      },
    });

    return detail;
  });
}

export async function confirmPosManualPayment(
  authContext: AuthContext,
  orderId: string,
  paymentId: string,
  data: ResolvePosPaymentRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  return resolvePosManualPayment(
    authContext,
    orderId,
    paymentId,
    data,
    "paid",
    requestMeta,
    db,
  );
}

export async function failPosManualPayment(
  authContext: AuthContext,
  orderId: string,
  paymentId: string,
  data: ResolvePosPaymentRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  return resolvePosManualPayment(
    authContext,
    orderId,
    paymentId,
    data,
    "failed",
    requestMeta,
    db,
  );
}

export async function createPosOrderItem(
  authContext: AuthContext,
  orderId: string,
  data: CreatePosOrderItemRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  const tenantId = requirePosTenantId(authContext);

  return db.transaction(async (tx) => {
    const order = await loadOrderOrThrow(tx, { tenantId, orderId });
    requirePosBranchAccess(authContext, order.branchId);
    assertOrderCanChangeItems(order);

    const resolved = await resolveOrderItemPricing(tx, {
      authContext,
      tenantId,
      currency: order.currency,
      data,
    });

    const item = await createManualOrderItemRecord(tx, {
      ...resolved,
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
      reason: resolved.overrideReason,
      after: {
        itemId: item.id,
        serviceId: item.serviceId,
        pricingUnit: item.pricingUnit,
        standardUnitAmount: item.standardUnitAmount,
        chargedUnitAmount: item.chargedUnitAmount,
        quantity: item.quantity,
        weight: item.weight,
        bagCount: item.bagCount,
      },
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
  const tenantId = requirePosTenantId(authContext);

  return db.transaction(async (tx) => {
    const order = await loadOrderOrThrow(tx, { tenantId, orderId });
    requirePosBranchAccess(authContext, order.branchId);
    assertOrderCanChangeItems(order);

    const existing = await findPosOrderItemById(tx, {
      tenantId,
      orderId,
      itemId,
    });
    if (!existing) {
      throw new PosOrderError(
        "ORDER_ITEM_NOT_FOUND",
        "Order item was not found.",
        404,
      );
    }
    const resolved = await resolveOrderItemPricing(tx, {
      authContext,
      tenantId,
      currency: order.currency,
      data,
      existing,
    });

    const result = await updateManualOrderItemRecord(tx, {
      ...resolved,
      tenantId,
      orderId,
      itemId,
      version: data.version,
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
      reason: resolved.overrideReason,
      before: {
        serviceId: existing.serviceId,
        pricingUnit: existing.pricingUnit,
        standardUnitAmount: existing.standardUnitAmount,
        chargedUnitAmount: existing.chargedUnitAmount,
        quantity: existing.quantity,
        weight: existing.weight,
        bagCount: existing.bagCount,
      },
      after: {
        itemId,
        serviceId: resolved.serviceId,
        pricingUnit: resolved.pricingUnit,
        standardUnitAmount: resolved.standardUnitAmount,
        chargedUnitAmount: resolved.chargedUnitAmount,
        quantity: resolved.quantity,
        weight: resolved.weight,
        bagCount: resolved.bagCount,
      },
    });

    return detail;
  });
}

export async function deletePosOrderItem(
  authContext: AuthContext,
  orderId: string,
  itemId: string,
  data: DeletePosOrderItemRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  const tenantId = requirePosTenantId(authContext);
  const reason = authorizePosSensitiveOperation(
    authContext,
    "delete",
    data.reason,
  );

  return db.transaction(async (tx) => {
    const order = await loadOrderOrThrow(tx, { tenantId, orderId });
    requirePosBranchAccess(authContext, order.branchId);
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
      reason,
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
  const tenantId = requirePosTenantId(authContext);

  if (query.branchId) {
    requirePosBranchAccess(authContext, query.branchId);
  }

  return findPosOrderOverview(db, {
    tenantId,
    allowedBranchIds: resolvePosBranchScope(authContext),
    branchId: query.branchId,
    period: query.period ?? "today",
    createdAfter: query.createdAfter,
    createdBefore: query.createdBefore,
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
    reason?: string;
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
    reason: input.reason,
    before: input.before,
    after: input.after,
    metadata: input.metadata,
    ipAddress: requestMeta?.ipAddress,
    userAgent: requestMeta?.userAgent,
  });
}
