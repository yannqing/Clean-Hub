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
  lockPosCheckoutIdempotencyKey,
  recalculateOrderPaymentState,
  resolveCardPaymentTransaction,
  resolveManualPaymentTransaction,
  softDeleteOrderItemRecord,
  softDeleteOrderRecord,
  sumOrderItemAmounts,
  updateManualOrderItemRecord,
  updateOrderRecord,
  type ResolvedPosOrderItemInput,
} from "./orders.repository.js";
import {
  findPosCatalogProductBySkuId,
  findPosCatalogServiceById,
} from "../catalog/catalog.repository.js";
import { releaseActivePosOrderDiscounts } from "../discounts/discounts.repository.js";
import {
  repricePosOrderDiscounts,
  resolveRequestedPosDiscountRule,
} from "../discounts/discounts.service.js";
import { minorToMoney, moneyToMinor } from "../discounts/pricing-engine.js";
import { findShiftByIdForUpdate } from "../staff/staff.repository.js";
import { findTerminalSettingsById } from "../terminal-settings/terminal-settings.repository.js";
import { applyPosOrderFinancialRules } from "./orders.financial.js";
import {
  consumeProductInventoryForPaidOrder,
  releaseExpiredProductReservations,
  releaseProductOrderReservations,
  reserveProductOrderItem,
} from "./orders.inventory.js";
import type {
  ChangePosOrderStatusRequest,
  CreatePosCheckoutRequest,
  CreatePosCheckoutResponse,
  CreateManualOrderItemRequest,
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
  RecordPosCardPaymentOutcomeRequest,
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
    (data.paymentMethod === "cash"
      ? data.tenderedAmount && data.shiftId && data.occurredAt
        ? payment.shiftId === data.shiftId &&
          moneyToMinor(payment.tenderedAmount ?? "0") ===
            moneyToMinor(data.tenderedAmount) &&
          payment.paidAt === new Date(data.occurredAt).toISOString()
        : payment.shiftId === null && payment.tenderedAmount === null
      : data.paymentMethod === "card"
        ? payment.gateway === "tpe"
        : payment.provider === data.provider &&
          payment.externalReference === data.externalReference)
  );
}

async function assertPaymentMethodEnabled(
  db: Database,
  authContext: AuthContext,
  tenantId: string,
  paymentMethod: CreatePosPaymentRequest["paymentMethod"],
): Promise<void> {
  if (!authContext.terminalId) return;
  const terminal = await findTerminalSettingsById(
    db,
    tenantId,
    authContext.terminalId,
  );
  if (!terminal?.paymentMethodsEnabled.includes(paymentMethod)) {
    throw new PosOrderError(
      "PAYMENT_NOT_SUPPORTED",
      `Payment method ${paymentMethod} is disabled for this terminal.`,
      422,
    );
  }
}

async function validateCashShift(
  db: Database,
  input: {
    authContext: AuthContext;
    tenantId: string;
    branchId: string;
    shiftId: string;
    occurredAt: string;
  },
): Promise<Date> {
  const terminalId = input.authContext.terminalId;
  const terminalBranchId = input.authContext.terminalBranchId;
  if (!terminalId || !terminalBranchId) {
    throw new PosOrderError(
      "SHIFT_REQUIRED",
      "Cash payments require an enrolled POS terminal and an active shift.",
      403,
    );
  }

  const shift = await findShiftByIdForUpdate(db, {
    tenantId: input.tenantId,
    shiftId: input.shiftId,
  });
  const occurredAt = new Date(input.occurredAt);
  const startedAt = shift ? new Date(shift.startedAt) : null;
  const endedAt = shift?.endedAt ? new Date(shift.endedAt) : null;
  const futureToleranceMs = 5 * 60 * 1000;
  const occurredBeforePause =
    shift?.status !== "on_break" ||
    occurredAt.getTime() <= new Date(shift.updatedAt).getTime();
  const canReconcileAnotherStaffShift =
    input.authContext.role === "owner" || input.authContext.role === "manager";

  if (
    !shift ||
    (shift.staffId !== input.authContext.userId &&
      !canReconcileAnotherStaffShift) ||
    shift.branchId !== input.branchId ||
    shift.branchId !== terminalBranchId ||
    shift.terminalId !== terminalId ||
    !startedAt ||
    occurredAt.getTime() < startedAt.getTime() ||
    occurredAt.getTime() > Date.now() + futureToleranceMs ||
    (endedAt !== null && occurredAt.getTime() > endedAt.getTime()) ||
    !occurredBeforePause
  ) {
    throw new PosOrderError(
      "SHIFT_REQUIRED",
      "The cash payment does not belong to this operator's valid shift window.",
      409,
    );
  }

  return occurredAt;
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
  if (moneyToMinor(order.paidAmount) > BigInt(0) || order.status === "paid") {
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

async function assertOrderHasNoPendingManualPayment(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<void> {
  const pendingPayment = await findPendingManualPaymentForOrder(db, input);
  if (pendingPayment) {
    throw new PosOrderError(
      "PAYMENT_ALREADY_PENDING",
      "Resolve the pending Wave or Orange Money payment before changing order pricing.",
      409,
    );
  }
}

function moneyEquals(left: string, right: string): boolean {
  return moneyToMinor(left) === moneyToMinor(right);
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

export function assertGuestOrderItemAllowed(
  customerId: string | null,
  itemKind: ResolvedPosOrderItemInput["itemKind"],
): void {
  if (customerId === null && itemKind !== "product") {
    throw new PosOrderError(
      "CUSTOMER_REQUIRED",
      "A customer profile is required for non-retail services.",
      422,
    );
  }
}

function isTicketItemReference(
  item: CreateManualOrderItemRequest,
): item is Extract<CreateManualOrderItemRequest, { ticketId: string }> {
  return item.ticketId !== undefined;
}

export async function resolveOrderItemPricing(
  db: Database,
  input: {
    authContext: AuthContext;
    tenantId: string;
    branchId: string;
    currency: string;
    data: CreatePosOrderItemRequest | UpdatePosOrderItemRequest;
    existing?: PosOrderItem;
  },
): Promise<ResolvedPosOrderItemInput & { overrideReason?: string }> {
  const selectingProduct = input.data.productSkuId !== undefined;
  const selectingService = input.data.serviceId !== undefined;
  const productSkuId = selectingService
    ? null
    : (input.data.productSkuId ?? input.existing?.productSkuId);
  const serviceId = selectingProduct
    ? null
    : (input.data.serviceId ?? input.existing?.serviceId);
  if (!serviceId && !productSkuId) {
    throw new PosOrderError(
      "VALIDATION_ERROR",
      "A catalog service or product is required for every order item.",
      422,
    );
  }

  if (productSkuId) {
    const product = await findPosCatalogProductBySkuId(db, {
      tenantId: input.tenantId,
      branchId: input.branchId,
      productSkuId,
    });
    if (!product) {
      throw new PosOrderError(
        "VALIDATION_ERROR",
        "The selected product is not available at this branch or has no active price.",
        422,
      );
    }
    if (product.currency !== input.currency) {
      throw new PosOrderError(
        "VALIDATION_ERROR",
        "The selected product price currency does not match the order currency.",
        422,
      );
    }

    const productChanged =
      !input.existing || productSkuId !== input.existing.productSkuId;
    const standardUnitAmount =
      productChanged || !input.existing
        ? product.amount
        : input.existing.standardUnitAmount;
    const chargedUnitAmount =
      input.data.chargedUnitAmount ??
      (productChanged || !input.existing
        ? standardUnitAmount
        : input.existing.chargedUnitAmount);
    const priceWasSubmitted =
      input.data.chargedUnitAmount !== undefined || productChanged;
    const overrideReason =
      priceWasSubmitted && !moneyEquals(chargedUnitAmount, standardUnitAmount)
        ? authorizePosSensitiveOperation(
            input.authContext,
            "price_override",
            input.data.overrideReason,
          )
        : undefined;
    const quantity = input.data.quantity ?? input.existing?.quantity;
    if (
      !quantity ||
      !Number.isInteger(Number(quantity)) ||
      Number(quantity) < 1
    ) {
      throw new PosOrderError(
        "VALIDATION_ERROR",
        "A positive whole-number quantity is required for a product.",
        422,
      );
    }

    return {
      itemKind: "product",
      businessLine: null,
      serviceCategoryId: null,
      serviceId: null,
      productId: product.productId,
      productCategoryId: product.categoryId,
      productSkuId,
      productPriceId: product.productPriceId,
      itemName: product.variantName
        ? `${product.name} · ${product.variantName}`
        : product.name,
      sku: product.sku,
      barcode: product.barcode,
      variantName: product.variantName,
      unitOfMeasure: product.unitOfMeasure,
      unitCostAmount: product.unitCostAmount,
      trackInventory: product.trackInventory,
      allowNegativeStock: product.allowNegativeStock,
      pricingUnit: "per_item",
      standardUnitAmount,
      chargedUnitAmount,
      quantity,
      weight: null,
      bagCount: null,
      itemColor: null,
      defectNotes: null,
      specialRequest: null,
      itemIdentifier: product.barcode ?? product.sku,
      overrideReason,
    };
  }

  const resolvedServiceId = serviceId!;

  const service = await findPosCatalogServiceById(db, {
    tenantId: input.tenantId,
    branchId: input.branchId,
    serviceId: resolvedServiceId,
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
    !input.existing || resolvedServiceId !== input.existing.serviceId;
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
      itemKind: "service",
      businessLine: service.businessLine,
      serviceCategoryId: service.categoryId,
      serviceId: resolvedServiceId,
      productId: null,
      productCategoryId: null,
      productSkuId: null,
      productPriceId: null,
      itemName: service.name,
      sku: null,
      barcode: null,
      variantName: null,
      unitOfMeasure: null,
      unitCostAmount: null,
      trackInventory: false,
      allowNegativeStock: false,
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
    itemKind: "service",
    businessLine: service.businessLine,
    serviceCategoryId: service.categoryId,
    serviceId: resolvedServiceId,
    productId: null,
    productCategoryId: null,
    productSkuId: null,
    productPriceId: null,
    itemName: service.name,
    sku: null,
    barcode: null,
    variantName: null,
    unitOfMeasure: null,
    unitCostAmount: null,
    trackInventory: false,
    allowNegativeStock: false,
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
    draft: ["received", "paid", "cancelled"],
    received: ["paid", "cancelled"],
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
  const createdOrder = await findPosOrderRaw(db, { tenantId, orderId });
  if (!createdOrder) {
    throw new Error("Created order could not be loaded for pricing.");
  }
  await repricePosOrderDiscounts(db, {
    order: createdOrder,
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
  await releaseExpiredProductReservations(db, {
    tenantId,
    branchId: input.data.branchId,
    actorUserId: input.authContext.userId,
  });
  const discountReason = input.data.discountCode
    ? authorizePosSensitiveOperation(
        input.authContext,
        "discount",
        input.data.discountReason,
      )
    : undefined;
  const branch = await findBranchById(db, {
    tenantId,
    branchId: input.data.branchId,
  });

  if (!branch) {
    throw new PosOrderError("BRANCH_NOT_ALLOWED", "Branch was not found.", 404);
  }

  let customerId = input.data.customerId ?? null;
  const ticketReferences = input.data.items.filter(isTicketItemReference);
  const referencedTicketItemIds = ticketReferences.map(
    (item) => item.ticketItemId,
  );
  if (
    new Set(referencedTicketItemIds).size !== referencedTicketItemIds.length
  ) {
    throw new PosOrderError(
      "VALIDATION_ERROR",
      "A ticket item cannot be added to the same cart more than once.",
      422,
    );
  }

  const referencesByTicket = new Map<string, string[]>();
  for (const reference of ticketReferences) {
    const current = referencesByTicket.get(reference.ticketId) ?? [];
    current.push(reference.ticketItemId);
    referencesByTicket.set(reference.ticketId, current);
  }

  const ticketGroups: Array<{
    ticketId: string;
    customerId: string;
    items: Awaited<ReturnType<typeof findTicketItemsForOrder>>;
  }> = [];
  for (const [ticketId, ticketItemIds] of referencesByTicket) {
    const ticket = await findServiceTicketForOrder(db, { tenantId, ticketId });
    if (!ticket) {
      throw new PosOrderError(
        "SERVICE_TICKET_NOT_FOUND",
        "Service ticket was not found.",
        404,
      );
    }
    requirePosBranchAccess(input.authContext, ticket.branchId);
    if (ticket.branchId !== input.data.branchId) {
      throw new PosOrderError(
        "VALIDATION_ERROR",
        "All cart items must belong to the selected branch.",
        422,
      );
    }
    if (ticket.currency !== branch.defaultCurrency) {
      throw new PosOrderError(
        "VALIDATION_ERROR",
        "All cart items must use the branch currency.",
        422,
      );
    }
    if (customerId && customerId !== ticket.customerId) {
      throw new PosOrderError(
        "VALIDATION_ERROR",
        "All service ticket items in a cart must belong to the same customer.",
        422,
      );
    }
    customerId ??= ticket.customerId;

    const items = await findTicketItemsForOrder(db, {
      tenantId,
      ticketId,
      ticketItemIds,
    });
    if (items.length !== ticketItemIds.length) {
      throw new PosOrderError(
        "SERVICE_TICKET_EMPTY",
        "One or more selected ticket items were not found.",
        422,
      );
    }
    ticketGroups.push({
      ticketId,
      customerId: ticket.customerId,
      items,
    });
  }

  if (referencedTicketItemIds.length > 0) {
    const alreadyOrdered = await countAlreadyOrderedTicketItems(db, {
      tenantId,
      ticketItemIds: referencedTicketItemIds,
    });
    if (alreadyOrdered > 0) {
      throw new PosOrderError(
        "TICKET_ITEM_ALREADY_ORDERED",
        "One or more ticket items are already linked to an order.",
        409,
      );
    }
  }
  if (customerId) {
    await requireCustomerActive(db, { tenantId, customerId });
  }

  const resolvedItems: Array<
    ResolvedPosOrderItemInput & { overrideReason?: string }
  > = [];
  for (const item of input.data.items) {
    if (isTicketItemReference(item)) {
      continue;
    }
    const resolved = await resolveOrderItemPricing(db, {
      authContext: input.authContext,
      tenantId,
      branchId: input.data.branchId,
      currency: branch.defaultCurrency,
      data: item,
    });
    assertGuestOrderItemAllowed(customerId, resolved.itemKind);
    resolvedItems.push(resolved);
  }
  const totalAmount = sumOrderItemAmounts(
    [
      ...resolvedItems.map((item) => ({
        lineAmount: calculatePosOrderItemLineAmount(item),
      })),
      ...ticketGroups.flatMap((group) => group.items),
    ],
  );
  const orderId = await createOrderRecord(db, {
    id: input.data.id,
    tenantId,
    branchId: input.data.branchId,
    currency: branch.defaultCurrency,
    customerId,
    orderType: "manual",
    status: "received",
    totalAmount,
    expireAt: input.data.expireAt,
    notes: input.data.notes,
    actorUserId: input.authContext.userId,
  });

  const insertedItems =
    resolvedItems.length > 0
      ? await insertManualOrderItems(db, {
          tenantId,
          branchId: input.data.branchId,
          customerId,
          orderId,
          items: resolvedItems,
          actorUserId: input.authContext.userId,
        })
      : [];
  for (const group of ticketGroups) {
    await insertOrderItemsFromTicketItems(db, {
      tenantId,
      branchId: input.data.branchId,
      customerId: group.customerId,
      orderId,
      ticketId: group.ticketId,
      items: group.items,
      actorUserId: input.authContext.userId,
    });
  }
  for (const item of insertedItems) {
    await reserveProductOrderItem(db, {
      tenantId,
      branchId: input.data.branchId,
      orderId,
      actorUserId: input.authContext.userId,
      item,
    });
  }
  const createdOrder = await findPosOrderRaw(db, { tenantId, orderId });
  if (!createdOrder) {
    throw new Error("Created order could not be loaded for pricing.");
  }
  const requestedDiscountRule = input.data.discountCode
    ? await resolveRequestedPosDiscountRule(db, {
        tenantId,
        branchId: input.data.branchId,
        customerId,
        orderId,
        now: new Date(),
        request: {
          code: input.data.discountCode,
          reason: discountReason!,
          version: createdOrder.version,
          idempotencyKey: input.data.discountIdempotencyKey!,
        },
      })
    : undefined;
  await repricePosOrderDiscounts(db, {
    order: createdOrder,
    actorUserId: input.authContext.userId,
    requestedRule: requestedDiscountRule,
    idempotencyKey: input.data.discountIdempotencyKey,
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
      [
        ...resolvedItems
          .map((item) => item.overrideReason)
          .filter((reason): reason is string => Boolean(reason)),
        ...(discountReason ? [discountReason] : []),
      ].join(" | ") || undefined,
    after: detail,
    metadata: {
      priceOverrides: resolvedItems
        .filter((item) => item.overrideReason)
        .map((item) => ({
          itemKind: item.itemKind,
          serviceId: item.serviceId,
          productSkuId: item.productSkuId,
          standardUnitAmount: item.standardUnitAmount,
          chargedUnitAmount: item.chargedUnitAmount,
          reason: item.overrideReason,
        })),
      discountCode: input.data.discountCode,
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

    if (data.to === "draft") {
      throw new PosOrderError(
        "INVALID_STATUS_TRANSITION",
        "Orders cannot transition back to draft.",
        422,
      );
    }

    if (before.status === data.to) {
      if (data.to === "cancelled") {
        await releaseActivePosOrderDiscounts(tx, {
          tenantId,
          orderId,
          actorUserId: authContext.userId,
          reason: sensitiveReason ?? "Order cancelled.",
        });
        await releaseProductOrderReservations(tx, {
          tenantId,
          orderId,
          actorUserId: authContext.userId,
        });
      }
      const detail = await findPosOrderDetail(tx, { tenantId, orderId });
      if (!detail) {
        throw new Error("Order could not be loaded for status replay.");
      }
      return detail;
    }

    assertAllowedStatusTransition(before.status, data.to);

    const confirmsZeroTotalOrder =
      data.to === "paid" &&
      moneyToMinor(before.subtotalAmount) > BigInt(0) &&
      moneyToMinor(before.totalAmount) === BigInt(0) &&
      moneyToMinor(before.discountAmount) ===
        moneyToMinor(before.subtotalAmount) &&
      moneyToMinor(before.paidAmount) === BigInt(0) &&
      before.paymentStatus === "paid";
    if (data.to === "paid" && !confirmsZeroTotalOrder) {
      throw new PosOrderError(
        "INVALID_STATUS_TRANSITION",
        "Paid status is controlled by payment transactions unless a fully discounted zero-total order is being confirmed.",
        422,
      );
    }

    if (data.to === "delivered" && before.paymentStatus !== "paid") {
      throw new PosOrderError(
        "ORDER_NOT_PAID",
        "Order cannot be delivered before it is fully paid.",
        422,
      );
    }

    if (
      data.to === "cancelled" &&
      moneyToMinor(before.paidAmount) > BigInt(0)
    ) {
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

    const releasedDiscounts =
      data.to === "cancelled"
        ? await releaseActivePosOrderDiscounts(tx, {
            tenantId,
            orderId,
            actorUserId: authContext.userId,
            reason: sensitiveReason ?? "Order cancelled.",
          })
        : [];
    if (data.to === "cancelled") {
      await releaseProductOrderReservations(tx, {
        tenantId,
        orderId,
        actorUserId: authContext.userId,
      });
    } else if (data.to === "paid") {
      await consumeProductInventoryForPaidOrder(tx, {
        tenantId,
        orderId,
        actorUserId: authContext.userId,
      });
    }
    const detail = await findPosOrderDetail(tx, { tenantId, orderId });
    if (!detail) {
      throw new Error("Updated order could not be loaded.");
    }

    await writeOrderAudit(tx, authContext, requestMeta, {
      branchId: detail.branchId,
      eventType: confirmsZeroTotalOrder
        ? "pos.order.zero_total_confirmed"
        : "pos.order.status_changed",
      entityId: orderId,
      reason: sensitiveReason,
      before: {
        status: before.status,
        subtotalAmount: before.subtotalAmount,
        discountAmount: before.discountAmount,
        totalAmount: before.totalAmount,
        paidAmount: before.paidAmount,
        paymentStatus: before.paymentStatus,
        paidAt: before.paidAt,
      },
      after: {
        status: detail.status,
        subtotalAmount: detail.subtotalAmount,
        discountAmount: detail.discountAmount,
        totalAmount: detail.totalAmount,
        paidAmount: detail.paidAmount,
        paymentStatus: detail.paymentStatus,
        paidAt: detail.paidAt,
      },
      metadata: {
        ...(data.note ? { note: data.note } : {}),
        zeroTotalConfirmation: confirmsZeroTotalOrder,
        releasedDiscountApplications: releasedDiscounts,
      },
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
    const before = await lockOrderOrThrow(tx, { tenantId, orderId });
    requirePosBranchAccess(authContext, before.branchId);

    if (
      !["draft", "received", "cancelled"].includes(before.status) ||
      moneyToMinor(before.paidAmount) > BigInt(0)
    ) {
      throw new PosOrderError(
        "ORDER_CANNOT_BE_DELETED",
        "Only unpaid draft, received, or cancelled orders can be deleted.",
        422,
      );
    }

    const releasedDiscounts = await releaseActivePosOrderDiscounts(tx, {
      tenantId,
      orderId,
      actorUserId: authContext.userId,
      reason,
    });
    await releaseProductOrderReservations(tx, {
      tenantId,
      orderId,
      actorUserId: authContext.userId,
    });
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
      after: {
        deleted: true,
        discountAmount:
          releasedDiscounts.length > 0 ? "0.00" : before.discountAmount,
        totalAmount:
          releasedDiscounts.length > 0
            ? before.subtotalAmount
            : before.totalAmount,
        paymentStatus:
          releasedDiscounts.length > 0 ? "unpaid" : before.paymentStatus,
      },
      metadata: { releasedDiscountApplications: releasedDiscounts },
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

    await assertPaymentMethodEnabled(tx, authContext, tenantId, data.paymentMethod);

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
        "Resolve the pending mobile or card payment before recording another external payment.",
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

    let cashDetails:
      | {
          tenderedAmount: string;
          changeAmount: string;
          shiftId: string;
          occurredAt: Date;
        }
      | undefined;
    if (data.paymentMethod === "cash") {
      const hasAllShiftFields = Boolean(
        data.tenderedAmount && data.shiftId && data.occurredAt,
      );
      const hasAnyShiftField = Boolean(
        data.tenderedAmount || data.shiftId || data.occurredAt,
      );
      if (hasAnyShiftField && !hasAllShiftFields) {
        throw new PosOrderError(
          "VALIDATION_ERROR",
          "Cash tender, shift, and occurrence time must be supplied together.",
          422,
        );
      }
      if (hasAllShiftFields) {
        const amountMinor = moneyToMinor(data.amount);
        const tenderedMinor = moneyToMinor(data.tenderedAmount!);
        if (tenderedMinor < amountMinor) {
          throw new PosOrderError(
            "CASH_TENDER_INSUFFICIENT",
            "Tendered cash is less than the payment amount.",
            422,
          );
        }
        cashDetails = {
          tenderedAmount: minorToMoney(tenderedMinor),
          changeAmount: minorToMoney(tenderedMinor - amountMinor),
          shiftId: data.shiftId!,
          occurredAt: await validateCashShift(tx, {
            authContext,
            tenantId,
            branchId: before.branchId,
            shiftId: data.shiftId!,
            occurredAt: data.occurredAt!,
          }),
        };
      }
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
      ...cashDetails,
      provider: data.paymentMethod === "app" ? data.provider : undefined,
      gateway: data.paymentMethod === "card" ? "tpe" : undefined,
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
      await consumeProductInventoryForPaidOrder(tx, {
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
          ? payment.paymentMethod === "card"
            ? "pos.order.card_payment_initiated"
            : "pos.order.mobile_payment_recorded"
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
        tenderedAmount: payment.tenderedAmount,
        changeAmount: payment.changeAmount,
        shiftId: payment.shiftId,
        provider: payment.provider,
        externalReference: payment.externalReference,
        transactionStatus: payment.paymentStatus,
      },
    });

    return { order: detail, payment, idempotent: false };
  });
}

export async function recordPosCardPaymentOutcome(
  authContext: AuthContext,
  orderId: string,
  paymentId: string,
  data: RecordPosCardPaymentOutcomeRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  const tenantId = requirePosTenantId(authContext);
  return db.transaction(async (tx) => {
    const before = await lockOrderOrThrow(tx, { tenantId, orderId });
    requirePosBranchAccess(authContext, before.branchId);
    const payment = await findPaymentTransactionForUpdate(tx, {
      tenantId,
      orderId,
      paymentId,
    });
    if (!payment) {
      throw new PosOrderError("PAYMENT_NOT_FOUND", "Payment was not found.", 404);
    }
    if (payment.paymentMethod !== "card" || payment.gateway !== "tpe") {
      throw new PosOrderError(
        "PAYMENT_NOT_SUPPORTED",
        "Only a TPE card payment can receive a card outcome.",
        422,
      );
    }
    if (payment.paymentStatus !== "pending") {
      if (payment.providerStatus === data.outcome) {
        const idempotent = await findPosOrderDetail(tx, { tenantId, orderId });
        if (!idempotent) throw new Error("Resolved card order was not found.");
        return idempotent;
      }
      throw new PosOrderError(
        "PAYMENT_ALREADY_RESOLVED",
        "The TPE payment already has a final outcome.",
        409,
      );
    }
    if (
      data.outcome === "succeeded" &&
      Number(payment.amount) > Number(before.totalAmount) - Number(before.paidAmount)
    ) {
      throw new PosOrderError(
        "PAYMENT_AMOUNT_EXCEEDED",
        "The successful card amount exceeds the outstanding balance.",
        422,
      );
    }
    const resolved = await resolveCardPaymentTransaction(tx, {
      tenantId,
      paymentId,
      ...data,
      actorUserId: authContext.userId,
    });
    if (!resolved) {
      throw new PosOrderError(
        "PAYMENT_ALREADY_RESOLVED",
        "The TPE payment was already resolved.",
        409,
      );
    }
    if (data.outcome === "succeeded") {
      await recalculateOrderPaymentState(tx, {
        tenantId,
        orderId,
        actorUserId: authContext.userId,
      });
      await consumeProductInventoryForPaidOrder(tx, {
        tenantId,
        orderId,
        actorUserId: authContext.userId,
      });
    }
    const detail = await findPosOrderDetail(tx, { tenantId, orderId });
    if (!detail) throw new Error("Card payment order could not be loaded.");
    await writeOrderAudit(tx, authContext, requestMeta, {
      branchId: before.branchId,
      eventType: `pos.order.card_payment_${data.outcome}`,
      entityId: orderId,
      reason: data.failureReason,
      before: {
        paidAmount: before.paidAmount,
        paymentStatus: before.paymentStatus,
        paymentId,
        providerStatus: payment.providerStatus,
      },
      after: {
        paidAmount: detail.paidAmount,
        paymentStatus: detail.paymentStatus,
        paymentId,
        providerStatus: resolved.providerStatus,
        externalReference: resolved.externalReference,
        authorizationCode: resolved.authorizationCode,
      },
    });
    return detail;
  });
}

/**
 * Creates the sale and its initial payment under one PostgreSQL transaction.
 * External mobile-money confirmation remains asynchronous, but recording its
 * reference and the order can no longer be split by a power/network failure.
 */
export async function checkoutPosOrder(
  authContext: AuthContext,
  data: CreatePosCheckoutRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<CreatePosCheckoutResponse> {
  if (!data.order.id) {
    throw new PosOrderError(
      "VALIDATION_ERROR",
      "A stable client-generated order id is required for checkout recovery.",
      422,
    );
  }

  const tenantId = requirePosTenantId(authContext);
  return db.transaction(async (tx) => {
    await lockPosCheckoutIdempotencyKey(tx, {
      tenantId,
      orderId: data.order.id!,
    });
    const existedBefore = await findPosOrderDetail(tx, {
      tenantId,
      orderId: data.order.id!,
    });
    let order = await createPosOrder(
      { authContext, data: data.order, requestMeta },
      tx,
    );
    await applyPosOrderFinancialRules(tx, {
      authContext,
      tenantId,
      orderId: order.id,
      taxExemptionReason: data.taxExemptionReason,
      actorUserId: authContext.userId,
    });
    const financiallyFinalizedOrder = await findPosOrderDetail(tx, {
      tenantId,
      orderId: order.id,
    });
    if (!financiallyFinalizedOrder) {
      throw new Error("Financially finalized order could not be loaded.");
    }
    order = financiallyFinalizedOrder;

    if (
      moneyToMinor(order.totalAmount) !== moneyToMinor(data.expectedTotalAmount)
    ) {
      throw new PosOrderError(
        "PRICE_CHANGED",
        `The confirmed total changed from ${data.expectedTotalAmount} to ${order.totalAmount}. Refresh the price and confirm again.`,
        409,
      );
    }

    const requestedPayments = data.payments ?? (data.payment ? [data.payment] : []);
    if (requestedPayments.length === 0 || moneyToMinor(order.totalAmount) === BigInt(0)) {
      return {
        order,
        payment: null,
        payments: [],
        idempotent: Boolean(existedBefore),
      };
    }

    const normalizedPayments = requestedPayments.map((payment) => ({
      ...payment,
      amount: payment.amount ?? order.totalAmount,
    })) as CreatePosPaymentRequest[];
    const requestedMinor = normalizedPayments.reduce(
      (sum, payment) => sum + moneyToMinor(payment.amount),
      BigInt(0),
    );
    if (requestedMinor > moneyToMinor(order.totalAmount)) {
      throw new PosOrderError(
        "PAYMENT_AMOUNT_EXCEEDED",
        "The combined tender amount exceeds the order total.",
        422,
      );
    }
    const externalCount = normalizedPayments.filter(
      (payment) => payment.paymentMethod !== "cash",
    ).length;
    if (externalCount > 1) {
      throw new PosOrderError(
        "PAYMENT_ALREADY_PENDING",
        "A checkout can contain at most one pending card or mobile-money tender.",
        422,
      );
    }

    const results: CreatePosPaymentResponse[] = [];
    for (const payment of [...normalizedPayments].sort((left, right) =>
      left.paymentMethod === "cash" && right.paymentMethod !== "cash" ? -1 : 1,
    )) {
      results.push(
        await createPosOrderPayment(
          authContext,
          order.id,
          payment,
          requestMeta,
          tx,
        ),
      );
    }
    const finalOrder = results.at(-1)?.order ?? order;
    const payments = results.map((result) => result.payment);
    return {
      order: finalOrder,
      payment: payments[0] ?? null,
      payments,
      idempotent:
        Boolean(existedBefore) && results.every((result) => result.idempotent),
    };
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
      await consumeProductInventoryForPaidOrder(tx, {
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
    const order = await lockOrderOrThrow(tx, { tenantId, orderId });
    requirePosBranchAccess(authContext, order.branchId);
    assertOrderCanChangeItems(order);
    await assertOrderHasNoPendingManualPayment(tx, { tenantId, orderId });

    const resolved = await resolveOrderItemPricing(tx, {
      authContext,
      tenantId,
      branchId: order.branchId,
      currency: order.currency,
      data,
    });
    assertGuestOrderItemAllowed(order.customerId, resolved.itemKind);

    const item = await createManualOrderItemRecord(tx, {
      ...resolved,
      tenantId,
      branchId: order.branchId,
      customerId: order.customerId,
      orderId,
      actorUserId: authContext.userId,
    });
    await reserveProductOrderItem(tx, {
      tenantId,
      branchId: order.branchId,
      orderId,
      actorUserId: authContext.userId,
      item: {
        orderItemId: item.id,
        productSkuId: resolved.productSkuId,
        quantity: resolved.quantity,
        trackInventory: resolved.trackInventory,
        allowNegativeStock: resolved.allowNegativeStock,
      },
    });

    await repricePosOrderDiscounts(tx, {
      order,
      actorUserId: authContext.userId,
    });
    await applyPosOrderFinancialRules(tx, {
      authContext,
      tenantId,
      orderId,
      taxExemptionReason: order.taxExemptionReason,
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
    const order = await lockOrderOrThrow(tx, { tenantId, orderId });
    requirePosBranchAccess(authContext, order.branchId);
    assertOrderCanChangeItems(order);
    await assertOrderHasNoPendingManualPayment(tx, { tenantId, orderId });

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
      branchId: order.branchId,
      currency: order.currency,
      data,
      existing,
    });
    assertGuestOrderItemAllowed(order.customerId, resolved.itemKind);

    await releaseProductOrderReservations(tx, {
      tenantId,
      orderId,
      actorUserId: authContext.userId,
      orderItemIds: [itemId],
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

    await reserveProductOrderItem(tx, {
      tenantId,
      branchId: order.branchId,
      orderId,
      actorUserId: authContext.userId,
      item: {
        orderItemId: itemId,
        productSkuId: resolved.productSkuId,
        quantity: resolved.quantity,
        trackInventory: resolved.trackInventory,
        allowNegativeStock: resolved.allowNegativeStock,
      },
    });

    await repricePosOrderDiscounts(tx, {
      order,
      actorUserId: authContext.userId,
    });
    await applyPosOrderFinancialRules(tx, {
      authContext,
      tenantId,
      orderId,
      taxExemptionReason: order.taxExemptionReason,
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
    const order = await lockOrderOrThrow(tx, { tenantId, orderId });
    requirePosBranchAccess(authContext, order.branchId);
    assertOrderCanChangeItems(order);
    await assertOrderHasNoPendingManualPayment(tx, { tenantId, orderId });

    const item = await findPosOrderItemById(tx, { tenantId, orderId, itemId });
    if (!item) {
      throw new PosOrderError(
        "ORDER_ITEM_NOT_FOUND",
        "Order item was not found.",
        404,
      );
    }

    await releaseProductOrderReservations(tx, {
      tenantId,
      orderId,
      actorUserId: authContext.userId,
      orderItemIds: [itemId],
    });

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

    await repricePosOrderDiscounts(tx, {
      order,
      actorUserId: authContext.userId,
    });
    await applyPosOrderFinancialRules(tx, {
      authContext,
      tenantId,
      orderId,
      taxExemptionReason: order.taxExemptionReason,
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
    timeZone: authContext.timezone ?? "UTC",
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
