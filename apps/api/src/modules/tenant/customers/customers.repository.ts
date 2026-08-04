import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  customerAccounts,
  customers,
  orders,
  serviceTickets,
  type Database,
} from "@cleanhub/db";

import type {
  TenantCustomerListResponse,
  TenantCustomerRepositoryListInput,
  TenantCustomerSort,
  TenantCustomerSummary,
} from "./customers.types.js";

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function buildCustomerSort(sort: TenantCustomerSort): SQL[] {
  switch (sort) {
    case "created_asc":
      return [asc(customers.createdAt), asc(customers.id)];
    case "name_asc":
      return [asc(customers.fullName), asc(customers.id)];
    case "name_desc":
      return [desc(customers.fullName), desc(customers.id)];
    case "created_desc":
    default:
      return [desc(customers.createdAt), desc(customers.id)];
  }
}

function resolveEffectiveBranchIds(
  input: TenantCustomerRepositoryListInput,
): string[] | undefined {
  return input.branchId ? [input.branchId] : input.allowedBranchIds;
}

function buildCustomerFilters(
  db: Database,
  input: TenantCustomerRepositoryListInput,
): SQL[] {
  const filters: SQL[] = [
    eq(customers.tenantId, input.tenantId),
    isNull(customers.deletedAt),
    eq(customerAccounts.tenantId, input.tenantId),
    isNull(customerAccounts.deletedAt),
  ];

  if (input.status) {
    filters.push(eq(customers.status, input.status));
  }

  if (input.q) {
    const pattern = `%${escapeLikePattern(input.q)}%`;
    filters.push(
      or(
        sql`${customers.fullName} ilike ${pattern} escape '\\'`,
        sql`${customers.phone} ilike ${pattern} escape '\\'`,
        sql`${customers.email} ilike ${pattern} escape '\\'`,
        sql`${customerAccounts.accountName} ilike ${pattern} escape '\\'`,
        sql`${customerAccounts.phone} ilike ${pattern} escape '\\'`,
        sql`${customerAccounts.email} ilike ${pattern} escape '\\'`,
      )!,
    );
  }

  if (input.createdAfter) {
    filters.push(gte(customers.createdAt, new Date(input.createdAfter)));
  }

  if (input.createdBefore) {
    filters.push(lt(customers.createdAt, new Date(input.createdBefore)));
  }

  const effectiveBranchIds = resolveEffectiveBranchIds(input);
  if (effectiveBranchIds !== undefined) {
    if (effectiveBranchIds.length === 0) {
      filters.push(sql`false`);
    } else {
      filters.push(
        or(
          exists(
            db
              .select({ id: orders.id })
              .from(orders)
              .where(
                and(
                  eq(orders.tenantId, input.tenantId),
                  eq(orders.customerId, customers.id),
                  inArray(orders.branchId, effectiveBranchIds),
                  isNull(orders.deletedAt),
                ),
              ),
          ),
          exists(
            db
              .select({ id: serviceTickets.id })
              .from(serviceTickets)
              .where(
                and(
                  eq(serviceTickets.tenantId, input.tenantId),
                  eq(serviceTickets.customerId, customers.id),
                  inArray(serviceTickets.branchId, effectiveBranchIds),
                ),
              ),
          ),
        )!,
      );
    }
  }

  return filters;
}

function toCustomerSummary(row: {
  id: string;
  customerAccountId: string;
  accountName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: "active" | "disabled";
  createdAt: Date;
}): TenantCustomerSummary {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function findTenantCustomers(
  db: Database,
  input: TenantCustomerRepositoryListInput,
): Promise<TenantCustomerListResponse> {
  const filters = buildCustomerFilters(db, input);
  const where = and(...filters);
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: customers.id,
        customerAccountId: customers.customerAccountId,
        accountName: customerAccounts.accountName,
        fullName: customers.fullName,
        phone: customers.phone,
        email: customers.email,
        status: customers.status,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .innerJoin(
        customerAccounts,
        eq(customerAccounts.id, customers.customerAccountId),
      )
      .where(where)
      .orderBy(...buildCustomerSort(input.sort))
      .limit(input.limit)
      .offset(input.offset),
    db
      .select({ value: count() })
      .from(customers)
      .innerJoin(
        customerAccounts,
        eq(customerAccounts.id, customers.customerAccountId),
      )
      .where(where),
  ]);

  return {
    data: rows.map(toCustomerSummary),
    total: countRows[0]?.value ?? 0,
    limit: input.limit,
    offset: input.offset,
  };
}
