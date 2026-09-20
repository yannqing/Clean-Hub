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

import { createId } from "@cleanhub/id";

import {
  customerAccounts,
  customerAuthRefreshTokens,
  customerCredentials,
  customers,
  orders,
  serviceTickets,
  type Database,
} from "@cleanhub/db";

import type {
  TenantCustomerAccountCustomersRepositoryInput,
  TenantCustomerAccountCustomersResponse,
  TenantCustomerAccountDetail,
  TenantCustomerAccountListResponse,
  TenantCustomerAccountOverview,
  TenantCustomerAccountRepositoryDetailInput,
  TenantCustomerAccountRepositoryListInput,
  TenantCustomerAccountRepositoryOverviewInput,
  TenantCustomerAccountSort,
  TenantCustomerAccountSummary,
  TenantCustomerDetail,
  TenantCustomerListResponse,
  TenantCustomerOverview,
  TenantCustomerRepositoryListInput,
  TenantCustomerRepositoryDetailInput,
  TenantCustomerRepositoryOverviewInput,
  TenantCustomerSort,
  TenantCustomerSummary,
  UpdateTenantCustomerAccountRepositoryInput,
  UpdateTenantCustomerRepositoryInput,
} from "./customers.types.js";

type TenantCustomerFilterInput = Pick<
  TenantCustomerRepositoryListInput,
  | "tenantId"
  | "allowedBranchIds"
  | "branchId"
  | "status"
  | "q"
  | "createdAfter"
  | "createdBefore"
>;

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

function buildCustomerAccountSort(sort: TenantCustomerAccountSort): SQL[] {
  switch (sort) {
    case "created_asc":
      return [asc(customerAccounts.createdAt), asc(customerAccounts.id)];
    case "name_asc":
      return [asc(customerAccounts.accountName), asc(customerAccounts.id)];
    case "name_desc":
      return [desc(customerAccounts.accountName), desc(customerAccounts.id)];
    case "created_desc":
    default:
      return [desc(customerAccounts.createdAt), desc(customerAccounts.id)];
  }
}

function resolveEffectiveBranchIds(
  input: TenantCustomerFilterInput,
): string[] | undefined {
  return input.branchId ? [input.branchId] : input.allowedBranchIds;
}

function buildCustomerFilters(
  db: Database,
  input: TenantCustomerFilterInput,
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
        sql`${customers.id} ilike ${pattern} escape '\\'`,
        sql`${customers.customerAccountId} ilike ${pattern} escape '\\'`,
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
                  inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
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

function buildCustomerAccountFilters(
  db: Database,
  input: TenantCustomerAccountRepositoryListInput,
): SQL[] {
  const filters: SQL[] = [
    eq(customerAccounts.tenantId, input.tenantId),
    isNull(customerAccounts.deletedAt),
  ];

  if (input.status) {
    filters.push(eq(customerAccounts.status, input.status));
  }

  if (input.q) {
    const pattern = `%${escapeLikePattern(input.q)}%`;
    filters.push(
      or(
        sql`${customerAccounts.id} ilike ${pattern} escape '\\'`,
        sql`${customerAccounts.accountName} ilike ${pattern} escape '\\'`,
        sql`${customerAccounts.phone} ilike ${pattern} escape '\\'`,
        sql`${customerAccounts.email} ilike ${pattern} escape '\\'`,
        exists(
          db
            .select({ id: customers.id })
            .from(customers)
            .where(
              and(
                eq(customers.tenantId, input.tenantId),
                eq(customers.customerAccountId, customerAccounts.id),
                isNull(customers.deletedAt),
                or(
                  sql`${customers.id} ilike ${pattern} escape '\\'`,
                  sql`${customers.fullName} ilike ${pattern} escape '\\'`,
                  sql`${customers.phone} ilike ${pattern} escape '\\'`,
                  sql`${customers.email} ilike ${pattern} escape '\\'`,
                ),
              ),
            ),
        ),
      )!,
    );
  }

  if (input.allowedBranchIds !== undefined) {
    if (input.allowedBranchIds.length === 0) {
      filters.push(sql`false`);
    } else {
      filters.push(
        exists(
          db
            .select({ id: customers.id })
            .from(customers)
            .where(
              and(
                eq(customers.tenantId, input.tenantId),
                eq(customers.customerAccountId, customerAccounts.id),
                isNull(customers.deletedAt),
                or(
                  exists(
                    db
                      .select({ id: orders.id })
                      .from(orders)
                      .where(
                        and(
                          eq(orders.tenantId, input.tenantId),
                          eq(orders.customerId, customers.id),
                          inArray(orders.branchId, input.allowedBranchIds),
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
                          inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
                          inArray(
                            serviceTickets.branchId,
                            input.allowedBranchIds,
                          ),
                        ),
                      ),
                  ),
                ),
              ),
            ),
        ),
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

function toCustomerAccountSummary(row: {
  id: string;
  accountName: string;
  phone: string | null;
  email: string | null;
  status: "active" | "disabled";
  customerCount: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}): TenantCustomerAccountSummary {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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

export async function findTenantCustomerAccounts(
  db: Database,
  input: TenantCustomerAccountRepositoryListInput,
): Promise<TenantCustomerAccountListResponse> {
  const where = and(...buildCustomerAccountFilters(db, input));
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: customerAccounts.id,
        accountName: customerAccounts.accountName,
        phone: customerAccounts.phone,
        email: customerAccounts.email,
        status: customerAccounts.status,
        customerCount: sql<number>`count(${customers.id})::int`,
        createdAt: customerAccounts.createdAt,
        updatedAt: customerAccounts.updatedAt,
        version: customerAccounts.version,
      })
      .from(customerAccounts)
      .leftJoin(
        customers,
        and(
          eq(customers.tenantId, input.tenantId),
          eq(customers.customerAccountId, customerAccounts.id),
          isNull(customers.deletedAt),
        ),
      )
      .where(where)
      .groupBy(
        customerAccounts.id,
        customerAccounts.accountName,
        customerAccounts.phone,
        customerAccounts.email,
        customerAccounts.status,
        customerAccounts.createdAt,
        customerAccounts.updatedAt,
        customerAccounts.version,
      )
      .orderBy(...buildCustomerAccountSort(input.sort))
      .limit(input.limit)
      .offset(input.offset),
    db.select({ value: count() }).from(customerAccounts).where(where),
  ]);

  return {
    data: rows.map(toCustomerAccountSummary),
    total: countRows[0]?.value ?? 0,
    limit: input.limit,
    offset: input.offset,
  };
}

export async function findTenantCustomerAccountOverview(
  db: Database,
  input: TenantCustomerAccountRepositoryOverviewInput,
): Promise<TenantCustomerAccountOverview> {
  const where = and(
    ...buildCustomerAccountFilters(db, {
      ...input,
      q: undefined,
      status: undefined,
      sort: "created_desc",
      limit: 1,
      offset: 0,
    }),
  );
  const [row] = await db
    .select({
      totalAccounts: sql<number>`count(distinct ${customerAccounts.id})::int`,
      activeAccounts: sql<number>`count(distinct ${customerAccounts.id}) filter (where ${customerAccounts.status} = 'active')::int`,
      disabledAccounts: sql<number>`count(distinct ${customerAccounts.id}) filter (where ${customerAccounts.status} = 'disabled')::int`,
      linkedCustomers: sql<number>`count(distinct ${customers.id})::int`,
    })
    .from(customerAccounts)
    .leftJoin(
      customers,
      and(
        eq(customers.tenantId, input.tenantId),
        eq(customers.customerAccountId, customerAccounts.id),
        isNull(customers.deletedAt),
      ),
    )
    .where(where);

  return {
    totalAccounts: row?.totalAccounts ?? 0,
    activeAccounts: row?.activeAccounts ?? 0,
    disabledAccounts: row?.disabledAccounts ?? 0,
    linkedCustomers: row?.linkedCustomers ?? 0,
  };
}

export async function findTenantCustomerAccountDetail(
  db: Database,
  input: TenantCustomerAccountRepositoryDetailInput,
): Promise<TenantCustomerAccountDetail | null> {
  const where = and(
    ...buildCustomerAccountFilters(db, {
      tenantId: input.tenantId,
      allowedBranchIds: input.allowedBranchIds,
      q: undefined,
      status: undefined,
      sort: "created_desc",
      limit: 1,
      offset: 0,
    }),
    eq(customerAccounts.id, input.accountId),
  );
  const [row] = await db
    .select({
      id: customerAccounts.id,
      accountName: customerAccounts.accountName,
      phone: customerAccounts.phone,
      email: customerAccounts.email,
      status: customerAccounts.status,
      customerCount: sql<number>`count(${customers.id})::int`,
      createdAt: customerAccounts.createdAt,
      updatedAt: customerAccounts.updatedAt,
      version: customerAccounts.version,
    })
    .from(customerAccounts)
    .leftJoin(
      customers,
      and(
        eq(customers.tenantId, input.tenantId),
        eq(customers.customerAccountId, customerAccounts.id),
        isNull(customers.deletedAt),
      ),
    )
    .where(where)
    .groupBy(
      customerAccounts.id,
      customerAccounts.accountName,
      customerAccounts.phone,
      customerAccounts.email,
      customerAccounts.status,
      customerAccounts.createdAt,
      customerAccounts.updatedAt,
      customerAccounts.version,
    )
    .limit(1);

  return row ? toCustomerAccountSummary(row) : null;
}

export async function findTenantCustomerAccountCustomers(
  db: Database,
  input: TenantCustomerAccountCustomersRepositoryInput,
): Promise<TenantCustomerAccountCustomersResponse> {
  const where = and(
    ...buildCustomerFilters(db, {
      tenantId: input.tenantId,
      allowedBranchIds: input.allowedBranchIds,
      branchId: undefined,
      q: input.q,
      status: input.status,
      createdAfter: undefined,
      createdBefore: undefined,
    }),
    eq(customers.customerAccountId, input.accountId),
  );
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
      .orderBy(desc(customers.createdAt), desc(customers.id))
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

export async function findTenantCustomerAccountConflict(
  db: Database,
  input: {
    tenantId: string;
    accountId: string;
    phone?: string | null;
    email?: string | null;
  },
): Promise<"phone" | "email" | null> {
  if (input.phone) {
    const [row] = await db
      .select({ id: customerAccounts.id })
      .from(customerAccounts)
      .where(
        and(
          eq(customerAccounts.tenantId, input.tenantId),
          eq(customerAccounts.phone, input.phone.trim()),
          isNull(customerAccounts.deletedAt),
          sql`${customerAccounts.id} <> ${input.accountId}`,
        ),
      )
      .limit(1);
    if (row) return "phone";
  }

  if (input.email) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const [row] = await db
      .select({ id: customerAccounts.id })
      .from(customerAccounts)
      .where(
        and(
          eq(customerAccounts.tenantId, input.tenantId),
          sql`lower(${customerAccounts.email}) = ${normalizedEmail}`,
          isNull(customerAccounts.deletedAt),
          sql`${customerAccounts.id} <> ${input.accountId}`,
        ),
      )
      .limit(1);
    if (row) return "email";
  }

  return null;
}

export async function updateTenantCustomerAccountRecord(
  db: Database,
  input: UpdateTenantCustomerAccountRepositoryInput,
): Promise<TenantCustomerAccountSummary | null> {
  const set: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedBy: input.actorUserId,
    version: sql`${customerAccounts.version} + 1`,
  };

  if (input.data.accountName !== undefined) {
    set.accountName = input.data.accountName.trim();
  }
  if (input.data.phone !== undefined) {
    set.phone = input.data.phone?.trim() || null;
  }
  if (input.data.email !== undefined) {
    set.email = input.data.email?.trim().toLowerCase() || null;
  }
  if (input.data.status !== undefined) {
    set.status = input.data.status;
  }

  const [row] = await db
    .update(customerAccounts)
    .set(set)
    .where(
      and(
        eq(customerAccounts.tenantId, input.tenantId),
        eq(customerAccounts.id, input.accountId),
        eq(customerAccounts.version, input.data.version),
        isNull(customerAccounts.deletedAt),
      ),
    )
    .returning({
      id: customerAccounts.id,
      accountName: customerAccounts.accountName,
      phone: customerAccounts.phone,
      email: customerAccounts.email,
      status: customerAccounts.status,
      createdAt: customerAccounts.createdAt,
      updatedAt: customerAccounts.updatedAt,
      version: customerAccounts.version,
    });

  return row
    ? toCustomerAccountSummary({ ...row, customerCount: 0 })
    : null;
}

export async function findTenantCustomerDetail(
  db: Database,
  input: TenantCustomerRepositoryDetailInput,
): Promise<TenantCustomerDetail | null> {
  const where = and(
    ...buildCustomerFilters(db, {
      tenantId: input.tenantId,
      allowedBranchIds: input.allowedBranchIds,
      branchId: undefined,
      q: undefined,
      status: undefined,
      createdAfter: undefined,
      createdBefore: undefined,
    }),
    eq(customers.id, input.customerId),
  );
  const [row] = await db
    .select({
      id: customers.id,
      customerAccountId: customers.customerAccountId,
      accountName: customerAccounts.accountName,
      fullName: customers.fullName,
      phone: customers.phone,
      email: customers.email,
      status: customers.status,
      createdAt: customers.createdAt,
      userId: customers.userId,
      relationship: customers.relationship,
      address: customers.address,
      notes: customers.notes,
      updatedAt: customers.updatedAt,
      version: customers.version,
      accountPhone: customerAccounts.phone,
      accountEmail: customerAccounts.email,
      accountStatus: customerAccounts.status,
      accountCreatedAt: customerAccounts.createdAt,
      accountUpdatedAt: customerAccounts.updatedAt,
    })
    .from(customers)
    .innerJoin(
      customerAccounts,
      eq(customerAccounts.id, customers.customerAccountId),
    )
    .where(where)
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    customerAccountId: row.customerAccountId,
    accountName: row.accountName,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    userId: row.userId,
    relationship: row.relationship,
    address: row.address,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
    account: {
      id: row.customerAccountId,
      name: row.accountName,
      phone: row.accountPhone,
      email: row.accountEmail,
      status: row.accountStatus,
      createdAt: row.accountCreatedAt.toISOString(),
      updatedAt: row.accountUpdatedAt.toISOString(),
    },
  };
}

export async function updateTenantCustomerRecord(
  db: Database,
  input: UpdateTenantCustomerRepositoryInput,
): Promise<boolean> {
  const set: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedBy: input.actorUserId,
    version: sql`${customers.version} + 1`,
  };

  if (input.data.fullName !== undefined) {
    set.fullName = input.data.fullName.trim();
  }
  if (input.data.phone !== undefined) {
    set.phone = input.data.phone?.trim() || null;
  }
  if (input.data.email !== undefined) {
    set.email = input.data.email?.trim().toLowerCase() || null;
  }
  if (input.data.relationship !== undefined) {
    set.relationship = input.data.relationship?.trim() || null;
  }
  if (input.data.address !== undefined) {
    set.address = input.data.address?.trim() || null;
  }
  if (input.data.notes !== undefined) {
    set.notes = input.data.notes?.trim() || null;
  }
  if (input.data.status !== undefined) {
    set.status = input.data.status;
  }

  const [updated] = await db
    .update(customers)
    .set(set)
    .where(
      and(
        eq(customers.tenantId, input.tenantId),
        eq(customers.id, input.customerId),
        eq(customers.version, input.data.version),
        isNull(customers.deletedAt),
      ),
    )
    .returning({ id: customers.id });

  return Boolean(updated);
}

export async function findTenantCustomerOverview(
  db: Database,
  input: TenantCustomerRepositoryOverviewInput,
): Promise<TenantCustomerOverview> {
  const where = and(
    ...buildCustomerFilters(db, {
      ...input,
      q: undefined,
      status: undefined,
    }),
  );
  const [row] = await db
    .select({
      totalCustomers: sql<number>`count(*)::int`,
      activeCustomers: sql<number>`count(*) filter (where ${customers.status} = 'active')::int`,
      disabledCustomers: sql<number>`count(*) filter (where ${customers.status} = 'disabled')::int`,
      linkedAccounts: sql<number>`count(distinct ${customers.customerAccountId})::int`,
    })
    .from(customers)
    .innerJoin(
      customerAccounts,
      eq(customerAccounts.id, customers.customerAccountId),
    )
    .where(where);

  return {
    totalCustomers: row?.totalCustomers ?? 0,
    activeCustomers: row?.activeCustomers ?? 0,
    disabledCustomers: row?.disabledCustomers ?? 0,
    linkedAccounts: row?.linkedAccounts ?? 0,
  };
}

/**
 * Give a customer account a password, creating the credential if it has none.
 *
 * An upsert rather than an update: the common case at launch is a customer who
 * has never had a credential at all, because accounts are created by staff at
 * the counter and the OTP that would otherwise bootstrap one is not delivered
 * anywhere yet. The unique index on customer_account_id is what makes this
 * safe against two operators resetting at once.
 */
export async function upsertTenantCustomerCredentialRecord(
  db: Database,
  input: {
    tenantId: string;
    customerAccountId: string;
    passwordHash: string;
    actorUserId: string;
  },
): Promise<void> {
  const now = new Date();

  await db
    .insert(customerCredentials)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      customerAccountId: input.customerAccountId,
      passwordHash: input.passwordHash,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })
    .onConflictDoUpdate({
      target: customerCredentials.customerAccountId,
      set: {
        passwordHash: input.passwordHash,
        // Clear any lockout: the point of a reset is to let them back in.
        failedAttempts: 0,
        lockedUntil: null,
        deletedAt: null,
        deletedBy: null,
        updatedAt: now,
        updatedBy: input.actorUserId,
        version: sql`${customerCredentials.version} + 1`,
      },
    });
}

/** Drop the customer's sessions so a reset credential takes effect at once. */
export async function revokeTenantCustomerRefreshTokens(
  db: Database,
  input: { tenantId: string; customerAccountId: string },
): Promise<void> {
  await db
    .update(customerAuthRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(customerAuthRefreshTokens.tenantId, input.tenantId),
        eq(
          customerAuthRefreshTokens.customerAccountId,
          input.customerAccountId,
        ),
        isNull(customerAuthRefreshTokens.revokedAt),
      ),
    );
}
