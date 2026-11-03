import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  customerAccounts,
  customers,
  orderItems,
  orders,
  serviceTickets,
  ticketItems,
  type Database,
} from "@cleanhub/db";
import {
  POS_ORDER_CODE_SUFFIX_LENGTH,
  formatPosOrderCode,
  parsePosOrderCodeSuffix,
} from "@cleanhub/domain/order-codes";

import type {
  PosGlobalSearchItem,
  PosGlobalSearchRepositoryInput,
  PosGlobalSearchResponse,
} from "./search.types.js";

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function searchPattern(value: string): string {
  return `%${escapeLikePattern(value)}%`;
}

function branchScopeFilter(
  column: typeof orders.branchId | typeof serviceTickets.branchId,
  allowedBranchIds: string[] | undefined,
): SQL | undefined {
  if (allowedBranchIds === undefined) {
    return undefined;
  }
  if (allowedBranchIds.length === 0) {
    return sql`false`;
  }
  return inArray(column, allowedBranchIds);
}

function contactFrom(phone: string | null, email: string | null): string | null {
  return phone || email || null;
}

async function searchCustomerProfiles(
  db: Database,
  input: PosGlobalSearchRepositoryInput,
): Promise<PosGlobalSearchItem[]> {
  const pattern = searchPattern(input.q);

  const rows = await db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      phone: customers.phone,
      email: customers.email,
      status: customers.status,
      updatedAt: customers.updatedAt,
      accountName: customerAccounts.accountName,
      accountPhone: customerAccounts.phone,
      accountEmail: customerAccounts.email,
    })
    .from(customers)
    .innerJoin(
      customerAccounts,
      and(
        eq(customerAccounts.id, customers.customerAccountId),
        eq(customerAccounts.tenantId, customers.tenantId),
        isNull(customerAccounts.deletedAt),
      )!,
    )
    .where(
      and(
        eq(customers.tenantId, input.tenantId),
        isNull(customers.deletedAt),
        or(
          sql`${customers.id} ilike ${pattern} escape '\\'`,
          sql`${customers.fullName} ilike ${pattern} escape '\\'`,
          sql`${customers.phone} ilike ${pattern} escape '\\'`,
          sql`${customers.email} ilike ${pattern} escape '\\'`,
          sql`${customerAccounts.accountName} ilike ${pattern} escape '\\'`,
          sql`${customerAccounts.phone} ilike ${pattern} escape '\\'`,
          sql`${customerAccounts.email} ilike ${pattern} escape '\\'`,
        )!,
      ),
    )
    .orderBy(desc(customers.updatedAt))
    .limit(input.limit);

  return rows.map((row) => {
    const contact =
      contactFrom(row.phone, row.email) ??
      contactFrom(row.accountPhone, row.accountEmail);

    return {
      id: row.id,
      type: "customer",
      title: row.fullName,
      subtitle: contact ?? row.accountName,
      badge: row.status,
      href: `/customers/${row.id}`,
      updatedAt: row.updatedAt.toISOString(),
      metadata: {
        accountName: row.accountName,
        contact,
      },
    };
  });
}

async function searchServiceTickets(
  db: Database,
  input: PosGlobalSearchRepositoryInput,
): Promise<PosGlobalSearchItem[]> {
  const pattern = searchPattern(input.q);
  const filters: SQL[] = [
    eq(serviceTickets.tenantId, input.tenantId),
    inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
    isNull(serviceTickets.deletedAt),
  ];
  const scopedBranches = branchScopeFilter(
    serviceTickets.branchId,
    input.allowedBranchIds,
  );

  if (scopedBranches) {
    filters.push(scopedBranches);
  }

  filters.push(
    or(
      sql`${serviceTickets.id} ilike ${pattern} escape '\\'`,
      sql`${serviceTickets.ticketNo} ilike ${pattern} escape '\\'`,
      sql`${customers.fullName} ilike ${pattern} escape '\\'`,
      sql`${customers.phone} ilike ${pattern} escape '\\'`,
      sql`${customers.email} ilike ${pattern} escape '\\'`,
    )!,
  );

  const rows = await db
    .select({
      id: serviceTickets.id,
      ticketNo: serviceTickets.ticketNo,
      ticketStatus: serviceTickets.ticketStatus,
      updatedAt: serviceTickets.updatedAt,
      customerName: customers.fullName,
      itemCount: sql<number>`(
        select count(*)::int from ${ticketItems}
        where ${ticketItems.ticketId} = ${serviceTickets.id}
          and ${ticketItems.deletedAt} is null
      )`,
      totalAmount: sql<string>`coalesce((
        select sum(${ticketItems.lineAmount}) from ${ticketItems}
        where ${ticketItems.ticketId} = ${serviceTickets.id}
          and ${ticketItems.deletedAt} is null
      ), 0)`,
    })
    .from(serviceTickets)
    .leftJoin(
      customers,
      and(
        eq(customers.id, serviceTickets.customerId),
        eq(customers.tenantId, serviceTickets.tenantId),
        isNull(customers.deletedAt),
      )!,
    )
    .where(and(...filters))
    .orderBy(desc(serviceTickets.createdAt))
    .limit(input.limit);

  return rows.map((row) => ({
    id: row.id,
    type: "ticket",
    title: row.ticketNo ?? row.id,
    subtitle: row.customerName ?? undefined,
    badge: row.ticketStatus,
    href: `/tickets/${row.id}`,
    updatedAt: row.updatedAt.toISOString(),
    metadata: {
      itemCount: Number(row.itemCount ?? 0),
      totalAmount: row.totalAmount,
    },
  }));
}

async function searchOrders(
  db: Database,
  input: PosGlobalSearchRepositoryInput,
): Promise<PosGlobalSearchItem[]> {
  const filters: SQL[] = [
    eq(orders.tenantId, input.tenantId),
    isNull(orders.deletedAt),
  ];
  const scopedBranches = branchScopeFilter(orders.branchId, input.allowedBranchIds);

  if (scopedBranches) {
    filters.push(scopedBranches);
  }

  const displayCodeSuffix = parsePosOrderCodeSuffix(input.q);
  if (displayCodeSuffix) {
    filters.push(
      sql`upper(right(${orders.id}, ${POS_ORDER_CODE_SUFFIX_LENGTH})) = ${displayCodeSuffix}`,
    );
  } else {
    const pattern = searchPattern(input.q);
    filters.push(
      or(
        sql`${orders.id} ilike ${pattern} escape '\\'`,
        sql`${customers.fullName} ilike ${pattern} escape '\\'`,
        sql`${customers.phone} ilike ${pattern} escape '\\'`,
        sql`${customers.email} ilike ${pattern} escape '\\'`,
      )!,
    );
  }

  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalAmount: orders.totalAmount,
      updatedAt: orders.updatedAt,
      customerName: customers.fullName,
      itemCount: sql<number>`(
        select count(*)::int from ${orderItems}
        where ${orderItems.orderId} = ${orders.id}
          and ${orderItems.deletedAt} is null
      )`,
    })
    .from(orders)
    .leftJoin(
      customers,
      and(
        eq(customers.id, orders.customerId),
        eq(customers.tenantId, orders.tenantId),
        isNull(customers.deletedAt),
      )!,
    )
    .where(and(...filters))
    .orderBy(desc(orders.createdAt))
    .limit(input.limit);

  return rows.map((row) => ({
    id: row.id,
    type: "order",
    title: formatPosOrderCode(row.id),
    subtitle: row.customerName ?? undefined,
    badge: row.paymentStatus ?? row.status,
    href: `/orders/${row.id}`,
    updatedAt: row.updatedAt.toISOString(),
    metadata: {
      itemCount: Number(row.itemCount ?? 0),
      totalAmount: row.totalAmount,
    },
  }));
}

export async function searchPosGlobal(
  db: Database,
  input: PosGlobalSearchRepositoryInput,
): Promise<PosGlobalSearchResponse> {
  const [customersGroup, ticketsGroup, ordersGroup] = await Promise.all([
    searchCustomerProfiles(db, input),
    searchServiceTickets(db, input),
    searchOrders(db, input),
  ]);

  return {
    query: input.q,
    total: customersGroup.length + ticketsGroup.length + ordersGroup.length,
    groups: {
      customers: customersGroup,
      tickets: ticketsGroup,
      orders: ordersGroup,
    },
  };
}
