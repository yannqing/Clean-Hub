import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  branches,
  customers,
  orderDiscountApplications,
  orderItems,
  orderTicketReferences,
  orders,
  paymentTransactions,
  serviceTickets,
  tenantSettings,
  ticketItems,
  userProfiles,
  type Database,
} from "@cleanhub/db";
import {
  addCalendarDays,
  calendarDateStartToUtc,
  getDateOnlyInTimeZone,
} from "@cleanhub/domain/timezone";
import { createId } from "@cleanhub/id";
import {
  POS_ORDER_CODE_SUFFIX_LENGTH,
  parsePosOrderCodeSuffix,
} from "@cleanhub/domain/order-codes";

import type {
  PosOrderDetail,
  PosOrderItem,
  PosOrderListInput,
  PosOrderOverview,
  PosOrderOverviewPeriod,
  PosOrderSort,
  PosOrderSummary,
  PosOrderSettlementIntent,
  PosOrderTicketReference,
  PosOrderType,
  PosMobileMoneyProvider,
  PosPaymentMethod,
  PosPaymentTransaction,
  UpdatePosOrderRequest,
} from "./orders.types.js";
import { listPosOrderDiscountApplications } from "../discounts/discounts.repository.js";
import { minorToMoney, moneyToMinor } from "../discounts/pricing-engine.js";
import { projectPosOrderPaymentState } from "./order-payment-state.js";

export type ResolvedPosOrderItemInput = {
  itemKind: "service" | "product";
  businessLine: "laundry" | "car_wash" | "retail" | "delivery" | null;
  serviceCategoryId: string | null;
  serviceId: string | null;
  productId: string | null;
  productCategoryId: string | null;
  productSkuId: string | null;
  productPriceId: string | null;
  itemName: string;
  sku: string | null;
  barcode: string | null;
  variantName: string | null;
  unitOfMeasure: string | null;
  unitCostAmount: string | null;
  trackInventory: boolean;
  allowNegativeStock: boolean;
  pricingUnit: "per_item" | "per_kg";
  standardUnitAmount: string;
  chargedUnitAmount: string;
  quantity: string;
  weight: string | null;
  bagCount: number | null;
  itemColor?: string | null;
  defectNotes?: string | null;
  specialRequest?: string | null;
  itemIdentifier?: string | null;
};

/**
 * Serializes checkout attempts for the same tenant-scoped client order id.
 * This closes the race where two reconnect/retry requests both observe that
 * the order does not exist before either transaction inserts it.
 */
export async function lockPosCheckoutIdempotencyKey(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<void> {
  await db.execute(
    sql`select pg_advisory_xact_lock(
      hashtextextended(${input.tenantId} || ':' || ${input.orderId}, 0)
    )`,
  );
}

export async function updatePosOrderSettlementTerms(
  db: Database,
  input: {
    tenantId: string;
    orderId: string;
    settlementIntent: PosOrderSettlementIntent;
    balanceDueAt?: string;
    unpaidReason?: string;
    actorUserId: string;
  },
): Promise<void> {
  await db
    .update(orders)
    .set({
      settlementIntent: input.settlementIntent,
      balanceDueAt: input.balanceDueAt ? new Date(input.balanceDueAt) : null,
      unpaidReason: input.unpaidReason?.trim() || null,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${orders.version} + 1`,
    })
    .where(
      and(
        eq(orders.tenantId, input.tenantId),
        eq(orders.id, input.orderId),
        isNull(orders.deletedAt),
      ),
    );
}

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

export function calculatePosOrderItemLineAmount(
  input: Pick<
    ResolvedPosOrderItemInput,
    "pricingUnit" | "quantity" | "weight" | "chargedUnitAmount"
  >,
): string {
  const units =
    input.pricingUnit === "per_kg"
      ? Number(input.weight)
      : Number(input.quantity);
  return (units * Number(input.chargedUnitAmount)).toFixed(2);
}

function toOrderItem(row: typeof orderItems.$inferSelect): PosOrderItem {
  return {
    id: row.id,
    orderId: row.orderId,
    ticketId: row.ticketId,
    itemKind: row.itemKind,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    serviceId: row.serviceId,
    productSkuId: row.productSkuId,
    productPriceId: row.productPriceId,
    itemName: row.itemName,
    sku: row.skuSnapshot,
    barcode: row.barcodeSnapshot,
    variantName: row.variantNameSnapshot,
    unitOfMeasure: row.unitOfMeasureSnapshot,
    unitCostAmount: row.unitCostAmount,
    quantity: row.quantity,
    pricingUnit: row.pricingUnit,
    standardUnitAmount: row.standardUnitAmount ?? row.unitAmount,
    chargedUnitAmount: row.chargedUnitAmount ?? row.unitAmount,
    weight: row.weight,
    bagCount: row.bagCount,
    unitAmount: row.chargedUnitAmount ?? row.unitAmount,
    lineAmount: row.lineAmount,
    taxableAmount: row.taxableAmount,
    taxAmount: row.taxAmount,
    taxRateSnapshot: row.taxRateSnapshot,
    taxExemptionReason: row.taxExemptionReason,
    itemColor: row.itemColor,
    defectNotes: row.defectNotes,
    specialRequest: row.specialRequest,
    itemIdentifier: row.itemIdentifier,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

type OrderJoinedRow = typeof orders.$inferSelect & {
  customerName: string | null;
  itemCount: string | number | null;
  itemNames: string[] | null;
};

function toOrderSummary(row: OrderJoinedRow): PosOrderSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    currency: row.currency,
    customerId: row.customerId,
    customerName: row.customerName,
    orderType: row.orderType,
    status: row.status,
    subtotalAmount: row.subtotalAmount,
    discountAmount: row.discountAmount,
    taxableAmount: row.taxableAmount,
    taxAmount: row.taxAmount,
    taxRateSnapshot: row.taxRateSnapshot,
    pricesIncludeTax: row.pricesIncludeTax,
    taxExemptionReason: row.taxExemptionReason,
    taxRegistrationNumberSnapshot: row.taxRegistrationNumberSnapshot,
    roundingAdjustmentAmount: row.roundingAdjustmentAmount,
    totalAmount: row.totalAmount,
    paymentStatus: row.paymentStatus,
    paidAmount: row.paidAmount,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    settlementIntent: row.settlementIntent,
    balanceDueAt: row.balanceDueAt ? row.balanceDueAt.toISOString() : null,
    unpaidReason: row.unpaidReason,
    expireAt: row.expireAt ? row.expireAt.toISOString() : null,
    notes: row.notes,
    itemCount: Number(row.itemCount ?? 0),
    itemNames: row.itemNames ?? [],
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
    tenderedAmount: row.tenderedAmount,
    changeAmount: row.changeAmount,
    shiftId: row.shiftId,
    registerSessionId: row.registerSessionId,
    cashDrawerSessionId: row.cashDrawerSessionId,
    currency: row.currency,
    paymentStatus: row.paymentStatus,
    providerStatus: row.providerStatus,
    provider:
      row.gateway === "wave" || row.gateway === "orange_money"
        ? row.gateway
        : null,
    gateway: row.gateway,
    externalReference: row.externalId,
    authorizationCode: row.authorizationCode,
    failureCode: row.failureCode,
    failureReason: row.failureReason,
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
    const statuses = Array.isArray(query.status)
      ? query.status
      : [query.status];
    filters.push(inArray(orders.status, statuses));
  }
  if (query.q) {
    const displayCodeSuffix = parsePosOrderCodeSuffix(query.q);
    if (displayCodeSuffix) {
      filters.push(
        sql`upper(right(${orders.id}, ${POS_ORDER_CODE_SUFFIX_LENGTH})) = ${displayCodeSuffix}`,
      );
    } else {
      const pattern = `%${escapeLikePattern(query.q)}%`;
      filters.push(
        or(
          sql`${orders.id} ilike ${pattern} escape '\\'`,
          sql`${customers.fullName} ilike ${pattern} escape '\\'`,
        )!,
      );
    }
  }
  if (query.createdAfter) {
    filters.push(gte(orders.createdAt, new Date(query.createdAfter)));
  }
  if (query.createdBefore) {
    filters.push(lt(orders.createdAt, new Date(query.createdBefore)));
  }

  return filters;
}

function buildOrderSort(sort: PosOrderSort | undefined): SQL[] {
  switch (sort) {
    case "created_asc":
      return [asc(orders.createdAt), asc(orders.id)];
    case "amount_desc":
      return [
        desc(orders.totalAmount),
        desc(orders.createdAt),
        desc(orders.id),
      ];
    case "amount_asc":
      return [asc(orders.totalAmount), desc(orders.createdAt), desc(orders.id)];
    case "created_desc":
    default:
      return [desc(orders.createdAt), desc(orders.id)];
  }
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
      itemNames: sql<string[]>`coalesce((
        select array_agg(distinct ${orderItems.itemName} order by ${orderItems.itemName})
        from ${orderItems}
        where ${orderItems.orderId} = ${orders.id}
          and ${orderItems.deletedAt} is null
      ), array[]::text[])`,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(and(...buildOrderFilters(input)))
    .orderBy(...buildOrderSort(input.query.sort))
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
      itemNames: sql<string[]>`coalesce((
        select array_agg(distinct ${orderItems.itemName} order by ${orderItems.itemName})
        from ${orderItems}
        where ${orderItems.orderId} = ${orders.id}
          and ${orderItems.deletedAt} is null
      ), array[]::text[])`,
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
  const discountApplications = await listPosOrderDiscountApplications(
    db,
    input,
  );
  const ticketReferences = await listPosOrderTicketReferences(db, input);

  return {
    ...summary,
    items: itemRows.map(toOrderItem),
    discountApplications,
    ticketReferences,
  };
}

export async function findPosOrderRaw(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<typeof orders.$inferSelect | null> {
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
): Promise<typeof orders.$inferSelect | null> {
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
    subtotalAmount: order.subtotalAmount,
    discountAmount: order.discountAmount,
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
): Promise<typeof serviceTickets.$inferSelect | null> {
  const rows = await db
    .select()
    .from(serviceTickets)
    .where(
      and(
        eq(serviceTickets.id, input.ticketId),
        eq(serviceTickets.tenantId, input.tenantId),
        inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
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
        ne(orders.status, "cancelled"),
        isNull(orders.deletedAt),
      ),
    );

  return rows[0]?.count ?? 0;
}

export async function createOrderRecord(
  db: Database,
  input: {
    id?: string;
    tenantId: string;
    branchId: string;
    currency: string;
    customerId: string | null;
    orderType: PosOrderType;
    status: "draft" | "received";
    totalAmount: string;
    expireAt?: string | null;
    notes?: string | null;
    actorUserId: string;
  },
): Promise<string> {
  const orderId = input.id ?? createId();

  await db.insert(orders).values({
    id: orderId,
    tenantId: input.tenantId,
    branchId: input.branchId,
    currency: input.currency,
    customerId: input.customerId,
    orderType: input.orderType,
    status: input.status,
    subtotalAmount: input.totalAmount,
    discountAmount: "0",
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
      serviceId: item.serviceId,
      itemName: item.itemName,
      quantity: String(item.quantity),
      pricingUnit: item.pricingUnit ?? "per_item",
      standardUnitAmount: item.standardUnitAmount ?? item.unitAmount,
      chargedUnitAmount: item.chargedUnitAmount ?? item.unitAmount,
      weight: item.weight,
      bagCount: item.bagCount,
      unitAmount: item.unitAmount,
      lineAmount: item.lineAmount,
      itemColor: item.itemColor,
      defectNotes: item.defectNotes,
      specialRequest: item.specialRequest,
      itemIdentifier: item.labelCode,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })),
  );

  await insertOrderTicketReference(db, input);
}

/**
 * Record what the ticket said at checkout so the order keeps its fulfilment
 * context even after the ticket is edited or cancelled, the same rule the tax
 * snapshots on `orders` follow.
 */
async function insertOrderTicketReference(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    orderId: string;
    ticketId: string;
    items: (typeof ticketItems.$inferSelect)[];
    actorUserId: string;
  },
): Promise<void> {
  const ticketRows = await db
    .select({
      ticketNo: serviceTickets.ticketNo,
      remark: serviceTickets.remark,
      priority: serviceTickets.priority,
      expectedPickupAt: serviceTickets.expectedPickupAt,
      assistantName: userProfiles.displayName,
    })
    .from(serviceTickets)
    .leftJoin(userProfiles, eq(userProfiles.userId, serviceTickets.assistantId))
    .where(
      and(
        eq(serviceTickets.id, input.ticketId),
        eq(serviceTickets.tenantId, input.tenantId),
      ),
    )
    .limit(1);
  const ticket = ticketRows[0];
  if (!ticket) {
    return;
  }

  const itemAmount = input.items.reduce(
    (total, item) => total + Number(item.lineAmount),
    0,
  );

  await db
    .insert(orderTicketReferences)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      branchId: input.branchId,
      orderId: input.orderId,
      ticketId: input.ticketId,
      ticketNoSnapshot: ticket.ticketNo,
      ticketRemarkSnapshot: ticket.remark,
      prioritySnapshot: ticket.priority,
      expectedPickupAtSnapshot: ticket.expectedPickupAt,
      assistantNameSnapshot: ticket.assistantName,
      itemCount: input.items.length,
      itemAmount: itemAmount.toFixed(2),
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })
    .onConflictDoNothing({
      target: [orderTicketReferences.orderId, orderTicketReferences.ticketId],
    });
}

export async function listPosOrderTicketReferences(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<PosOrderTicketReference[]> {
  const rows = await db
    .select()
    .from(orderTicketReferences)
    .where(
      and(
        eq(orderTicketReferences.orderId, input.orderId),
        eq(orderTicketReferences.tenantId, input.tenantId),
      ),
    )
    .orderBy(orderTicketReferences.createdAt);

  return rows.map((row) => ({
    ticketId: row.ticketId,
    ticketNo: row.ticketNoSnapshot,
    remark: row.ticketRemarkSnapshot,
    priority: row.prioritySnapshot,
    expectedPickupAt: row.expectedPickupAtSnapshot?.toISOString() ?? null,
    assistantName: row.assistantNameSnapshot,
    itemCount: row.itemCount,
    itemAmount: row.itemAmount,
  }));
}

export async function insertManualOrderItems(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    customerId: string | null;
    orderId: string;
    items: ResolvedPosOrderItemInput[];
    actorUserId: string;
  },
): Promise<
  Array<{
    orderItemId: string;
    productSkuId: string | null;
    quantity: string;
    trackInventory: boolean;
    allowNegativeStock: boolean;
  }>
> {
  const records = input.items.map((item) => ({
    id: createId(),
    orderId: input.orderId,
    ticketId: null,
    tenantId: input.tenantId,
    branchId: input.branchId,
    customerId: input.customerId,
    itemKind: item.itemKind,
    sourceType: item.itemKind,
    sourceId:
      item.itemKind === "product" ? item.productSkuId! : item.serviceId!,
    serviceId: item.serviceId,
    productSkuId: item.productSkuId,
    productPriceId: item.productPriceId,
    itemName: item.itemName.trim(),
    skuSnapshot: item.sku,
    barcodeSnapshot: item.barcode,
    variantNameSnapshot: item.variantName,
    unitOfMeasureSnapshot: item.unitOfMeasure,
    unitCostAmount: item.unitCostAmount,
    quantity: item.quantity,
    pricingUnit: item.pricingUnit,
    standardUnitAmount: item.standardUnitAmount,
    chargedUnitAmount: item.chargedUnitAmount,
    weight: item.weight,
    bagCount: item.bagCount,
    unitAmount: item.chargedUnitAmount,
    lineAmount: calculatePosOrderItemLineAmount(item),
    itemColor: normalizeNullable(item.itemColor),
    defectNotes: normalizeNullable(item.defectNotes),
    specialRequest: normalizeNullable(item.specialRequest),
    itemIdentifier: normalizeNullable(item.itemIdentifier),
    createdBy: input.actorUserId,
    updatedBy: input.actorUserId,
  }));
  await db.insert(orderItems).values(records);
  return input.items.map((item, index) => ({
    orderItemId: records[index]!.id,
    productSkuId: item.productSkuId,
    quantity: item.quantity,
    trackInventory: item.trackInventory,
    allowNegativeStock: item.allowNegativeStock,
  }));
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
    to: "received" | "paid" | "delivered" | "cancelled";
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
    customerId: string | null;
    orderId: string;
    paymentMethod: PosPaymentMethod;
    amount: string;
    currency: string;
    actorUserId: string;
    tenderedAmount?: string;
    changeAmount?: string;
    shiftId?: string;
    registerSessionId?: string;
    cashDrawerSessionId?: string;
    occurredAt?: Date;
    provider?: PosMobileMoneyProvider;
    gateway?: string;
    externalReference?: string;
    idempotencyKey: string;
  },
): Promise<PosPaymentTransaction | null> {
  const paymentId = createId();
  const isCash = input.paymentMethod === "cash";
  const paidAt = isCash ? (input.occurredAt ?? new Date()) : null;

  const rows = await db
    .insert(paymentTransactions)
    .values({
      id: paymentId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      customerId: input.customerId,
      orderId: input.orderId,
      paymentMethod: input.paymentMethod,
      amount: input.amount,
      tenderedAmount: input.tenderedAmount,
      changeAmount: input.changeAmount,
      shiftId: input.shiftId,
      registerSessionId: input.registerSessionId,
      cashDrawerSessionId: input.cashDrawerSessionId,
      currency: input.currency,
      paymentStatus: isCash ? "paid" : "pending",
      providerStatus: isCash
        ? "not_applicable"
        : input.paymentMethod === "card"
          ? "initiated"
          : "pending",
      gateway:
        input.paymentMethod === "card"
          ? "tpe"
          : (input.gateway ?? input.provider),
      externalId: input.externalReference,
      idempotencyKey: input.idempotencyKey,
      paidAt,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })
    .onConflictDoNothing()
    .returning();

  return rows[0] ? toPaymentTransaction(rows[0]) : null;
}

export async function resolveCardPaymentTransaction(
  db: Database,
  input: {
    tenantId: string;
    paymentId: string;
    outcome: "succeeded" | "failed" | "cancelled" | "timed_out";
    externalReference?: string;
    authorizationCode?: string;
    failureCode?: string;
    failureReason?: string;
    providerPayload?: Record<string, unknown>;
    actorUserId: string;
  },
): Promise<PosPaymentTransaction | null> {
  const now = new Date();
  const rows = await db
    .update(paymentTransactions)
    .set({
      paymentStatus:
        input.outcome === "succeeded"
          ? "paid"
          : input.outcome === "timed_out"
            ? "pending"
            : "failed",
      providerStatus: input.outcome,
      externalId: input.externalReference,
      authorizationCode: input.authorizationCode,
      failureCode: input.failureCode,
      failureReason: input.failureReason,
      providerPayload: input.providerPayload,
      paidAt: input.outcome === "succeeded" ? now : null,
      updatedAt: now,
      updatedBy: input.actorUserId,
      version: sql`${paymentTransactions.version} + 1`,
    })
    .where(
      and(
        eq(paymentTransactions.id, input.paymentId),
        eq(paymentTransactions.tenantId, input.tenantId),
        eq(paymentTransactions.paymentMethod, "card"),
        eq(paymentTransactions.paymentStatus, "pending"),
        isNull(paymentTransactions.deletedAt),
      ),
    )
    .returning();
  return rows[0] ? toPaymentTransaction(rows[0]) : null;
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
        inArray(paymentTransactions.paymentMethod, ["app", "card"]),
        eq(paymentTransactions.paymentStatus, "pending"),
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

  const paidAmount = rows[0]?.paidAmount ?? "0";
  const latestPaidTransactionAt = rows[0]?.paidAt
    ? new Date(rows[0].paidAt)
    : null;
  const payment = projectPosOrderPaymentState({
    current: order,
    nextTotalAmount: order.totalAmount,
    nextPaidAmount: paidAmount,
    zeroTotalSettlement:
      moneyToMinor(order.subtotalAmount) > BigInt(0) &&
      moneyToMinor(order.discountAmount) === moneyToMinor(order.subtotalAmount),
    latestPaidTransactionAt,
  });

  await db
    .update(orders)
    .set({
      paidAmount,
      paidAt: payment.paidAt,
      paymentStatus: payment.paymentStatus,
      status: payment.status,
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
  input: ResolvedPosOrderItemInput & {
    tenantId: string;
    branchId: string;
    customerId: string | null;
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
    itemKind: input.itemKind,
    sourceType: input.itemKind,
    sourceId:
      input.itemKind === "product" ? input.productSkuId! : input.serviceId!,
    serviceId: input.serviceId,
    productSkuId: input.productSkuId,
    productPriceId: input.productPriceId,
    itemName: input.itemName.trim(),
    skuSnapshot: input.sku,
    barcodeSnapshot: input.barcode,
    variantNameSnapshot: input.variantName,
    unitOfMeasureSnapshot: input.unitOfMeasure,
    unitCostAmount: input.unitCostAmount,
    quantity: input.quantity,
    pricingUnit: input.pricingUnit,
    standardUnitAmount: input.standardUnitAmount,
    chargedUnitAmount: input.chargedUnitAmount,
    weight: input.weight,
    bagCount: input.bagCount,
    unitAmount: input.chargedUnitAmount,
    lineAmount: calculatePosOrderItemLineAmount(input),
    itemColor: normalizeNullable(input.itemColor),
    defectNotes: normalizeNullable(input.defectNotes),
    specialRequest: normalizeNullable(input.specialRequest),
    itemIdentifier: normalizeNullable(input.itemIdentifier),
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
  input: ResolvedPosOrderItemInput & {
    tenantId: string;
    orderId: string;
    itemId: string;
    version: number;
    actorUserId: string;
  },
): Promise<{ updated: boolean; exists: boolean }> {
  const existing = await findPosOrderItemById(db, input);
  if (!existing) {
    return { updated: false, exists: false };
  }

  const updatedRows = await db
    .update(orderItems)
    .set({
      itemKind: input.itemKind,
      serviceId: input.serviceId,
      productSkuId: input.productSkuId,
      productPriceId: input.productPriceId,
      sourceType: input.itemKind,
      sourceId:
        input.itemKind === "product" ? input.productSkuId! : input.serviceId!,
      itemName: input.itemName.trim(),
      skuSnapshot: input.sku,
      barcodeSnapshot: input.barcode,
      variantNameSnapshot: input.variantName,
      unitOfMeasureSnapshot: input.unitOfMeasure,
      unitCostAmount: input.unitCostAmount,
      quantity: input.quantity,
      pricingUnit: input.pricingUnit,
      standardUnitAmount: input.standardUnitAmount,
      chargedUnitAmount: input.chargedUnitAmount,
      weight: input.weight,
      bagCount: input.bagCount,
      unitAmount: input.chargedUnitAmount,
      lineAmount: calculatePosOrderItemLineAmount(input),
      itemColor: normalizeNullable(input.itemColor),
      defectNotes: normalizeNullable(input.defectNotes),
      specialRequest: normalizeNullable(input.specialRequest),
      itemIdentifier: normalizeNullable(input.itemIdentifier),
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
      subtotalAmount: sql<string>`coalesce(sum(${orderItems.lineAmount}), 0)`,
      discountAmount: sql<string>`(
        select coalesce(sum(${orderDiscountApplications.amount}), 0)
        from ${orderDiscountApplications}
        where ${orderDiscountApplications.tenantId} = ${input.tenantId}
          and ${orderDiscountApplications.orderId} = ${input.orderId}
          and ${orderDiscountApplications.status} = 'applied'
      )`,
    })
    .from(orderItems)
    .where(
      and(
        eq(orderItems.tenantId, input.tenantId),
        eq(orderItems.orderId, input.orderId),
        isNull(orderItems.deletedAt),
      ),
    );

  const subtotalMinor = moneyToMinor(rows[0]?.subtotalAmount ?? "0");
  const requestedDiscountMinor = moneyToMinor(rows[0]?.discountAmount ?? "0");
  const discountMinor =
    requestedDiscountMinor > subtotalMinor
      ? subtotalMinor
      : requestedDiscountMinor;

  await db
    .update(orders)
    .set({
      subtotalAmount: minorToMoney(subtotalMinor),
      discountAmount: minorToMoney(discountMinor),
      totalAmount: minorToMoney(subtotalMinor - discountMinor),
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

function getPeriodStart(
  period: PosOrderOverviewPeriod,
  timeZone: string,
): Date | null {
  if (period === "all") {
    return null;
  }

  const today = getDateOnlyInTimeZone(new Date(), timeZone);
  if (period === "today") {
    return calendarDateStartToUtc(today, timeZone);
  }
  if (period === "week") {
    return calendarDateStartToUtc(addCalendarDays(today, -6), timeZone);
  }
  return calendarDateStartToUtc(`${today.slice(0, 7)}-01`, timeZone);
}

export async function findPosOrderOverview(
  db: Database,
  input: {
    tenantId: string;
    allowedBranchIds?: string[];
    branchId?: string;
    period: PosOrderOverviewPeriod;
    createdAfter?: string;
    createdBefore?: string;
    timeZone: string;
  },
): Promise<PosOrderOverview> {
  const effectiveBranchId =
    input.branchId ??
    (input.allowedBranchIds?.length === 1
      ? input.allowedBranchIds[0]
      : undefined);
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
  const start = input.createdAfter
    ? new Date(input.createdAfter)
    : getPeriodStart(input.period, input.timeZone);
  const end = input.createdBefore ? new Date(input.createdBefore) : null;
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
  if (end) {
    orderFilters.push(lt(orders.createdAt, end));
    paymentFilters.push(lt(paymentTransactions.paidAt, end));
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
