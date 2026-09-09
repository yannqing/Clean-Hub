import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  customers,
  customerAccounts,
  orders,
  orderItems,
  serviceTickets,
  ticketItems,
  userProfiles,
  type Database,
} from "@cleanhub/db";
import { getDateOnlyInTimeZone } from "@cleanhub/domain/timezone";
import { createId } from "@cleanhub/id";

import type {
  CreateServiceTicketRequest,
  ServiceTicketAuditSnapshot,
  ServiceTicketDetail,
  ServiceTicketItem,
  ServiceTicketListInput,
  ServiceTicketOverview,
  ServiceTicketStatus,
  ServiceTicketSummary,
  UpdateServiceTicketRequest,
} from "./service-tickets.types.js";

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function toTicketItem(
  row: typeof ticketItems.$inferSelect,
): ServiceTicketItem {
  return {
    id: row.id,
    ticketId: row.ticketId,
    itemType: row.itemType,
    itemName: row.itemName,
    itemCategory: row.itemCategory,
    itemStatus: row.itemStatus,
    itemColor: row.itemColor,
    itemBrand: row.itemBrand,
    itemMaterial: row.itemMaterial,
    quantity: row.quantity,
    pricingUnit: row.pricingUnit ?? "per_item",
    standardUnitAmount: row.standardUnitAmount ?? row.unitAmount,
    chargedUnitAmount: row.chargedUnitAmount ?? row.unitAmount,
    weight: row.weight,
    bagCount: row.bagCount,
    unitAmount: row.chargedUnitAmount ?? row.unitAmount,
    lineAmount: row.lineAmount,
    serviceId: row.serviceId,
    labelCode: row.labelCode,
    defectNotes: row.defectNotes,
    specialRequest: row.specialRequest,
    remark: row.remark,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

type TicketJoinedRow = typeof serviceTickets.$inferSelect & {
  customerAccountName: string | null;
  customerAccountPhone: string | null;
  customerName: string | null;
  customerProfileName: string | null;
  customerProfilePhone: string | null;
  assistantName: string | null;
  itemCount: string | number | null;
  totalAmount: string | null;
};

function toTicketSummary(row: TicketJoinedRow): ServiceTicketSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    currency: row.currency,
    customerId: row.customerId,
    customerName: row.customerName ?? "",
    customerAccountName: row.customerAccountName,
    customerAccountPhone: row.customerAccountPhone,
    customerProfileName: row.customerProfileName ?? row.customerName,
    customerProfilePhone: row.customerProfilePhone,
    assistantId: row.assistantId,
    assistantName: row.assistantName,
    ticketNo: row.ticketNo,
    ticketType: row.ticketType,
    ticketStatus: row.ticketStatus,
    priority: row.priority,
    sourceChannel: row.sourceChannel,
    expectedPickupAt: row.expectedPickupAt
      ? row.expectedPickupAt.toISOString()
      : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    itemCount: Number(row.itemCount ?? 0),
    totalAmount: row.totalAmount ?? "0",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

function toTicketAuditSnapshot(
  ticket: typeof serviceTickets.$inferSelect,
): ServiceTicketAuditSnapshot {
  return {
    tenantId: ticket.tenantId,
    branchId: ticket.branchId,
    currency: ticket.currency,
    customerId: ticket.customerId,
    ticketType: ticket.ticketType,
    ticketStatus: ticket.ticketStatus,
    priority: ticket.priority,
    sourceChannel: ticket.sourceChannel,
    expectedPickupAt: ticket.expectedPickupAt
      ? ticket.expectedPickupAt.toISOString()
      : null,
    remark: ticket.remark,
  };
}

/**
 * Generate a tenant-unique, human-readable ticket number.
 *
 * Format: `TK-YYMMDD-{branchDailySeq:04d}`, e.g. `TK-260622-0007`.
 *
 * The sequence is the count of tickets already created for this branch on the
 * same calendar day (resolved within the caller's transaction so concurrent
 * inserts serialize through the `(tenant_id, ticket_no)` unique index). The
 * index is the final guarantee of tenant uniqueness; if two requests race to
 * the same sequence number, the second insert fails and the service layer can
 * retry.
 */
async function generateTicketNo(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    now: Date;
    timeZone: string;
  },
): Promise<string> {
  const datePrefix = getDateOnlyInTimeZone(input.now, input.timeZone)
    .slice(2)
    .replaceAll("-", "");

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceTickets)
    .where(
      and(
        eq(serviceTickets.tenantId, input.tenantId),
        eq(serviceTickets.branchId, input.branchId),
        sql`to_char(${serviceTickets.createdAt} AT TIME ZONE ${input.timeZone}, 'YYMMDD') = ${datePrefix}`,
      ),
    );

  const seq = (countRows[0]?.count ?? 0) + 1;

  return `TK-${datePrefix}-${String(seq).padStart(4, "0")}`;
}

/**
 * Generate a tenant-unique label code for a ticket item.
 *
 * Format: `{ticketNo}-{itemSeq:03d}`, e.g. `TK-260622-0007-003`. The sequence
 * is the 1-based position of the item within its ticket (resolved within the
 * caller's transaction).
 */
export async function generateLabelCode(
  db: Database,
  input: { tenantId: string; ticketId: string; ticketNo: string | null },
): Promise<string> {
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ticketItems)
    .where(
      and(
        eq(ticketItems.tenantId, input.tenantId),
        eq(ticketItems.ticketId, input.ticketId),
        isNull(ticketItems.deletedAt),
      ),
    );

  const seq = (countRows[0]?.count ?? 0) + 1;
  const ticketPart = input.ticketNo ?? input.ticketId.slice(-12).toUpperCase();

  return `${ticketPart}-${String(seq).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// List / detail
// ---------------------------------------------------------------------------

export async function findServiceTickets(
  db: Database,
  input: ServiceTicketListInput,
): Promise<ServiceTicketSummary[]> {
  const filters = buildServiceTicketFilters(input);

  const rows = await db
    .select({
      ticket: serviceTickets,
      customerName: customers.fullName,
      customerAccountName: customerAccounts.accountName,
      customerAccountPhone: customerAccounts.phone,
      customerProfileName: customers.fullName,
      customerProfilePhone: customers.phone,
      assistantName: userProfiles.displayName,
      itemCount: sql<number>`(
        select count(*)::int from ${ticketItems}
        where ${ticketItems.ticketId} = ${serviceTickets.id}
          and ${ticketItems.tenantId} = ${serviceTickets.tenantId}
          and ${ticketItems.deletedAt} is null
      )`,
      totalAmount: sql<string>`coalesce((
        select sum(${ticketItems.lineAmount}) from ${ticketItems}
        where ${ticketItems.ticketId} = ${serviceTickets.id}
          and ${ticketItems.tenantId} = ${serviceTickets.tenantId}
          and ${ticketItems.deletedAt} is null
      ), 0)`,
    })
    .from(serviceTickets)
    .leftJoin(customers, eq(customers.id, serviceTickets.customerId))
    .leftJoin(
      customerAccounts,
      eq(customerAccounts.id, customers.customerAccountId),
    )
    .leftJoin(
      userProfiles,
      and(
        eq(userProfiles.userId, serviceTickets.assistantId),
        eq(userProfiles.tenantId, input.tenantId),
      ),
    )
    .where(and(...filters))
    .orderBy(desc(serviceTickets.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  return rows.map((row) => toTicketSummary({ ...row.ticket, ...row }));
}

/**
 * Count tickets matching the SAME filter set as `findServiceTickets` (minus
 * limit/offset), so the list endpoint can return a total for pagination.
 * The customer-name `q` filter forces the same LEFT JOIN as the list query so
 * the two counts agree.
 */
export async function countServiceTickets(
  db: Database,
  input: ServiceTicketListInput,
): Promise<number> {
  const filters = buildServiceTicketFilters(input);

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceTickets)
    .leftJoin(customers, eq(customers.id, serviceTickets.customerId))
    .where(and(...filters));

  return rows[0]?.count ?? 0;
}

/**
 * Build the WHERE filter array shared by list and count. Centralized so the
 * total returned for pagination always matches the rows returned.
 */
function buildServiceTicketFilters(input: ServiceTicketListInput): SQL[] {
  const filters: SQL[] = [
    eq(serviceTickets.tenantId, input.tenantId),
    inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
    isNull(serviceTickets.deletedAt),
  ];

  if (input.allowedBranchIds !== undefined) {
    if (input.allowedBranchIds.length === 0) {
      // Sentinel: caller is branch-scoped to an empty set. Push a clause that
      // matches nothing so both list and count short-circuit consistently.
      filters.push(sql`false`);
      return filters;
    }
    filters.push(inArray(serviceTickets.branchId, input.allowedBranchIds));
  }

  if (input.branchId) {
    filters.push(eq(serviceTickets.branchId, input.branchId));
  }

  if (input.status && input.status.length > 0) {
    filters.push(inArray(serviceTickets.ticketStatus, input.status));
  }

  if (input.priority) {
    filters.push(eq(serviceTickets.priority, input.priority));
  }

  if (input.ticketType) {
    filters.push(eq(serviceTickets.ticketType, input.ticketType));
  }

  if (input.sourceChannel) {
    filters.push(eq(serviceTickets.sourceChannel, input.sourceChannel));
  }

  if (input.customerId) {
    filters.push(eq(serviceTickets.customerId, input.customerId));
  }

  if (input.assistantId) {
    filters.push(eq(serviceTickets.assistantId, input.assistantId));
  }

  if (input.q) {
    const query = `%${escapeLikePattern(input.q)}%`;
    filters.push(
      or(
        sql`${serviceTickets.ticketNo} ilike ${query} escape '\\'`,
        sql`${serviceTickets.ticketType}::text ilike ${query} escape '\\'`,
        sql`${customers.fullName} ilike ${query} escape '\\'`,
        sql`${customers.phone} ilike ${query} escape '\\'`,
        sql`${customerAccounts.accountName} ilike ${query} escape '\\'`,
        sql`${customerAccounts.phone} ilike ${query} escape '\\'`,
      )!,
    );
  }

  if (input.createdAfter) {
    filters.push(gte(serviceTickets.createdAt, new Date(input.createdAfter)));
  }

  if (input.createdBefore) {
    filters.push(lt(serviceTickets.createdAt, new Date(input.createdBefore)));
  }

  if (input.expectedPickupBefore) {
    filters.push(
      lte(
        serviceTickets.expectedPickupAt,
        new Date(input.expectedPickupBefore),
      ),
    );
  }

  if (input.expectedPickupAfter) {
    filters.push(
      gt(serviceTickets.expectedPickupAt, new Date(input.expectedPickupAfter)),
    );
  }

  return filters;
}

export async function findServiceTicketById(
  db: Database,
  input: { tenantId: string; ticketId: string },
): Promise<ServiceTicketSummary | null> {
  const rows = await db
    .select({
      ticket: serviceTickets,
      customerName: customers.fullName,
      customerAccountName: customerAccounts.accountName,
      customerAccountPhone: customerAccounts.phone,
      customerProfileName: customers.fullName,
      customerProfilePhone: customers.phone,
      assistantName: userProfiles.displayName,
      itemCount: sql<number>`(
        select count(*)::int from ${ticketItems}
        where ${ticketItems.ticketId} = ${serviceTickets.id}
          and ${ticketItems.tenantId} = ${serviceTickets.tenantId}
          and ${ticketItems.deletedAt} is null
      )`,
      totalAmount: sql<string>`coalesce((
        select sum(${ticketItems.lineAmount}) from ${ticketItems}
        where ${ticketItems.ticketId} = ${serviceTickets.id}
          and ${ticketItems.tenantId} = ${serviceTickets.tenantId}
          and ${ticketItems.deletedAt} is null
      ), 0)`,
    })
    .from(serviceTickets)
    .leftJoin(customers, eq(customers.id, serviceTickets.customerId))
    .leftJoin(
      customerAccounts,
      eq(customerAccounts.id, customers.customerAccountId),
    )
    .leftJoin(
      userProfiles,
      and(
        eq(userProfiles.userId, serviceTickets.assistantId),
        eq(userProfiles.tenantId, input.tenantId),
      ),
    )
    .where(
      and(
        eq(serviceTickets.id, input.ticketId),
        eq(serviceTickets.tenantId, input.tenantId),
        inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
        isNull(serviceTickets.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  return row ? toTicketSummary({ ...row.ticket, ...row }) : null;
}

export async function findServiceTicketDetail(
  db: Database,
  input: { tenantId: string; ticketId: string },
): Promise<ServiceTicketDetail | null> {
  const summary = await findServiceTicketById(db, input);
  if (!summary) {
    return null;
  }

  const itemRows = await db
    .select()
    .from(ticketItems)
    .where(
      and(
        eq(ticketItems.ticketId, input.ticketId),
        eq(ticketItems.tenantId, input.tenantId),
        isNull(ticketItems.deletedAt),
      ),
    )
    .orderBy(asc(ticketItems.sortOrder), asc(ticketItems.createdAt));

  // Fetch the ticket remark (not present on summary).
  const ticketRows = await db
    .select({ remark: serviceTickets.remark })
    .from(serviceTickets)
    .where(
      and(
        eq(serviceTickets.id, input.ticketId),
        eq(serviceTickets.tenantId, input.tenantId),
      ),
    )
    .limit(1);

  return {
    ...summary,
    remark: ticketRows[0]?.remark ?? null,
    items: itemRows.map(toTicketItem),
  };
}

export async function findServiceTicketRaw(
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
    .limit(1);

  return rows[0] ?? null;
}

export async function findServiceTicketAuditSnapshot(
  db: Database,
  input: { tenantId: string; ticketId: string },
): Promise<ServiceTicketAuditSnapshot | null> {
  const ticket = await findServiceTicketRaw(db, input);
  return ticket ? toTicketAuditSnapshot(ticket) : null;
}

// ---------------------------------------------------------------------------
// Create / update / delete
// ---------------------------------------------------------------------------

export async function createServiceTicketRecord(
  db: Database,
  input: CreateServiceTicketRequest & {
    tenantId: string;
    currency: string;
    assistantId: string;
    actorUserId: string;
    timeZone: string;
  },
): Promise<ServiceTicketSummary> {
  const ticketId = createId();
  const now = new Date();
  const ticketNo = await generateTicketNo(db, {
    tenantId: input.tenantId,
    branchId: input.branchId,
    now,
    timeZone: input.timeZone,
  });

  await db.insert(serviceTickets).values({
    id: ticketId,
    tenantId: input.tenantId,
    branchId: input.branchId,
    currency: input.currency,
    customerId: input.customerId,
    assistantId: normalizeNullable(input.assistantId),
    ticketNo,
    ticketType: input.ticketType,
    ticketStatus: "draft",
    priority: input.priority ?? "normal",
    sourceChannel: input.sourceChannel ?? "pos",
    expectedPickupAt: input.expectedPickupAt
      ? new Date(input.expectedPickupAt)
      : null,
    remark: input.remark ?? null,
    createdBy: input.actorUserId,
    updatedBy: input.actorUserId,
  });

  const ticket = await findServiceTicketById(db, {
    tenantId: input.tenantId,
    ticketId,
  });

  if (!ticket) {
    throw new Error("Created service ticket could not be loaded.");
  }

  return ticket;
}

export async function updateServiceTicketRecord(
  db: Database,
  input: UpdateServiceTicketRequest & {
    tenantId: string;
    ticketId: string;
    actorUserId: string;
  },
): Promise<ServiceTicketSummary | null> {
  const existing = await findServiceTicketRaw(db, input);
  if (!existing) {
    return null;
  }

  await db
    .update(serviceTickets)
    .set({
      ticketType: input.ticketType ?? existing.ticketType,
      priority: input.priority ?? existing.priority,
      sourceChannel: input.sourceChannel ?? existing.sourceChannel,
      assistantId:
        input.assistantId === undefined
          ? existing.assistantId
          : normalizeNullable(input.assistantId),
      expectedPickupAt:
        input.expectedPickupAt === undefined
          ? existing.expectedPickupAt
          : input.expectedPickupAt
            ? new Date(input.expectedPickupAt)
            : null,
      remark:
        input.remark === undefined ? existing.remark : (input.remark ?? null),
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${serviceTickets.version} + 1`,
    })
    .where(
      and(
        eq(serviceTickets.id, input.ticketId),
        eq(serviceTickets.tenantId, input.tenantId),
        isNull(serviceTickets.deletedAt),
      ),
    );

  return findServiceTicketById(db, input);
}

export async function changeServiceTicketStatusRecord(
  db: Database,
  input: {
    tenantId: string;
    ticketId: string;
    actorUserId: string;
    version: number;
    to: ServiceTicketStatus;
  },
): Promise<{ updated: boolean; exists: boolean }> {
  const updatedRows = await db
    .update(serviceTickets)
    .set({
      ticketStatus: input.to,
      completedAt: input.to === "picked_up" ? new Date() : sql`completed_at`,
      cancelledAt: input.to === "cancelled" ? new Date() : sql`cancelled_at`,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${serviceTickets.version} + 1`,
    })
    .where(
      and(
        eq(serviceTickets.id, input.ticketId),
        eq(serviceTickets.tenantId, input.tenantId),
        eq(serviceTickets.version, input.version),
        isNull(serviceTickets.deletedAt),
      ),
    )
    .returning({ id: serviceTickets.id });

  if (updatedRows[0]) {
    return { updated: true, exists: true };
  }

  const existing = await findServiceTicketRaw(db, input);
  return { updated: false, exists: Boolean(existing) };
}

export async function softDeleteServiceTicketRecord(
  db: Database,
  input: { tenantId: string; ticketId: string; actorUserId: string },
): Promise<boolean> {
  const updatedRows = await db
    .update(serviceTickets)
    .set({
      deletedAt: new Date(),
      deletedBy: input.actorUserId,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${serviceTickets.version} + 1`,
    })
    .where(
      and(
        eq(serviceTickets.id, input.ticketId),
        eq(serviceTickets.tenantId, input.tenantId),
        isNull(serviceTickets.deletedAt),
      ),
    )
    .returning({ id: serviceTickets.id });

  return Boolean(updatedRows[0]);
}

// ---------------------------------------------------------------------------
// Status-change settlement check (ready_to_pick → picked_up)
// ---------------------------------------------------------------------------

/**
 * Whether every active ticket item is linked to a non-cancelled order and all
 * of those orders are settled.
 *
 * A linked order is any `orders` row whose `order_items` reference this ticket
 * (the `order_items.ticket_id` back-pointer). The milestone rule: a ticket may
 * only move to `picked_up` once every item has been billed and every linked
 * order is paid. Cancelled orders do not reserve ticket items and therefore do
 * not count as billed or settled.
 */
/**
 * Whether a ticket item is already carried by a live order.
 *
 * Removing such an item would drop it out of the settlement coverage count as
 * well, so the ticket would look fully billed and could be handed over even
 * though the customer never paid for that garment.
 */
/**
 * Whether any money has already been taken for this ticket. Cancelling such a
 * ticket would close it while the customer's payment stays on the order, so the
 * refund has to happen first.
 *
 * Partial payments count: the customer is owed that money too.
 */
export async function hasCollectedPaymentForTicket(
  db: Database,
  input: { tenantId: string; ticketId: string },
): Promise<boolean> {
  const rows = await db
    .select({ paymentStatus: orders.paymentStatus })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.tenantId, input.tenantId),
        eq(orderItems.tenantId, input.tenantId),
        eq(orderItems.ticketId, input.ticketId),
        ne(orders.status, "cancelled"),
        inArray(orders.paymentStatus, ["paid", "partial"]),
        isNull(orderItems.deletedAt),
        isNull(orders.deletedAt),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export async function isTicketItemBilled(
  db: Database,
  input: { tenantId: string; ticketId: string; itemId: string },
): Promise<boolean> {
  const rows = await db
    .select({ orderId: orders.id })
    .from(orderItems)
    .innerJoin(
      orders,
      and(
        eq(orders.id, orderItems.orderId),
        eq(orders.tenantId, input.tenantId),
        ne(orders.status, "cancelled"),
        isNull(orders.deletedAt),
      ),
    )
    .where(
      and(
        eq(orderItems.tenantId, input.tenantId),
        eq(orderItems.ticketId, input.ticketId),
        eq(orderItems.sourceType, "ticket_item"),
        eq(orderItems.sourceId, input.itemId),
        isNull(orderItems.deletedAt),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export async function areLinkedOrdersSettled(
  db: Database,
  input: { tenantId: string; ticketId: string },
): Promise<boolean> {
  const itemCoverageRows = await db
    .select({
      itemCount: sql<number>`count(distinct ${ticketItems.id})::int`,
      billedItemCount: sql<number>`count(distinct ${ticketItems.id}) filter (
        where ${orders.id} is not null
      )::int`,
    })
    .from(ticketItems)
    .leftJoin(
      orderItems,
      and(
        eq(orderItems.tenantId, input.tenantId),
        eq(orderItems.ticketId, input.ticketId),
        eq(orderItems.sourceType, "ticket_item"),
        eq(orderItems.sourceId, ticketItems.id),
        isNull(orderItems.deletedAt),
      ),
    )
    .leftJoin(
      orders,
      and(
        eq(orders.id, orderItems.orderId),
        eq(orders.tenantId, input.tenantId),
        ne(orders.status, "cancelled"),
        isNull(orders.deletedAt),
      ),
    )
    .where(
      and(
        eq(ticketItems.tenantId, input.tenantId),
        eq(ticketItems.ticketId, input.ticketId),
        isNull(ticketItems.deletedAt),
      ),
    );
  const coverage = itemCoverageRows[0];
  if (!coverage) {
    return false;
  }

  const rows = await db
    .select({
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.tenantId, input.tenantId),
        eq(orderItems.tenantId, input.tenantId),
        eq(orderItems.ticketId, input.ticketId),
        ne(orders.status, "cancelled"),
        isNull(orderItems.deletedAt),
        isNull(orders.deletedAt),
      ),
    )
    .groupBy(orders.id, orders.paymentStatus);

  return isTicketSettlementComplete({
    itemCount: coverage.itemCount,
    billedItemCount: coverage.billedItemCount,
    paymentStatuses: rows.map((row) => row.paymentStatus),
  });
}

export function isTicketSettlementComplete(input: {
  itemCount: number;
  billedItemCount: number;
  paymentStatuses: string[];
}): boolean {
  return (
    input.itemCount > 0 &&
    input.billedItemCount === input.itemCount &&
    input.paymentStatuses.length > 0 &&
    input.paymentStatuses.every((status) => status === "paid")
  );
}

// ---------------------------------------------------------------------------
// Related orders
// ---------------------------------------------------------------------------

export async function findRelatedOrders(
  db: Database,
  input: { tenantId: string; ticketId: string },
) {
  const rows = await db
    .select({
      id: orders.id,
      ticketItemIds: sql<string[]>`coalesce(
        array_agg(distinct ${orderItems.sourceId}) filter (
          where ${orderItems.sourceType} = 'ticket_item'
            and ${orderItems.deletedAt} is null
        ),
        array[]::varchar[]
      )`,
      currency: orders.currency,
      orderType: orders.orderType,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalAmount: orders.totalAmount,
      paidAmount: orders.paidAmount,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.tenantId, input.tenantId),
        eq(orderItems.tenantId, input.tenantId),
        eq(orderItems.ticketId, input.ticketId),
        isNull(orderItems.deletedAt),
        isNull(orders.deletedAt),
      ),
    )
    .groupBy(orders.id)
    .orderBy(desc(orders.createdAt));

  return rows.map((row) => ({
    id: row.id,
    ticketItemIds: row.ticketItemIds,
    currency: row.currency,
    orderType: row.orderType,
    status: row.status,
    paymentStatus: row.paymentStatus,
    totalAmount: row.totalAmount,
    paidAmount: row.paidAmount,
    createdAt: row.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function findServiceTicketOverview(
  db: Database,
  input: {
    tenantId: string;
    allowedBranchIds?: string[];
    branchId?: string;
    timeZone: string;
  },
): Promise<ServiceTicketOverview> {
  const baseFilters: SQL[] = [
    eq(serviceTickets.tenantId, input.tenantId),
    inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
    isNull(serviceTickets.deletedAt),
  ];

  if (input.allowedBranchIds !== undefined) {
    if (input.allowedBranchIds.length === 0) {
      return {
        tenantId: input.tenantId,
        branchId: input.branchId ?? null,
        byStatus: {},
        overdueCount: 0,
        todayCreatedCount: 0,
        todayPickedUpCount: 0,
      };
    }
    baseFilters.push(inArray(serviceTickets.branchId, input.allowedBranchIds));
  }

  if (input.branchId) {
    baseFilters.push(eq(serviceTickets.branchId, input.branchId));
  }

  const statusRows = await db
    .select({
      status: serviceTickets.ticketStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(serviceTickets)
    .where(and(...baseFilters))
    .groupBy(serviceTickets.ticketStatus);

  const byStatus: Partial<Record<ServiceTicketStatus, number>> = {};
  for (const row of statusRows) {
    byStatus[row.status] = row.count;
  }

  const overdueRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceTickets)
    .where(
      and(
        ...baseFilters,
        inArray(serviceTickets.ticketStatus, [
          "pending",
          "in_progress",
          "ready_to_pick",
        ]),
        lte(serviceTickets.expectedPickupAt, new Date()),
      ),
    );

  const todayStart = sql`date_trunc('day', now() AT TIME ZONE ${input.timeZone}) AT TIME ZONE ${input.timeZone}`;
  const todayCreatedRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceTickets)
    .where(
      and(...baseFilters, sql`${serviceTickets.createdAt} >= ${todayStart}`),
    );

  const todayPickedUpRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceTickets)
    .where(
      and(
        ...baseFilters,
        eq(serviceTickets.ticketStatus, "picked_up"),
        sql`${serviceTickets.completedAt} >= ${todayStart}`,
      ),
    );

  return {
    tenantId: input.tenantId,
    branchId: input.branchId ?? null,
    byStatus,
    overdueCount: overdueRows[0]?.count ?? 0,
    todayCreatedCount: todayCreatedRows[0]?.count ?? 0,
    todayPickedUpCount: todayPickedUpRows[0]?.count ?? 0,
  };
}
