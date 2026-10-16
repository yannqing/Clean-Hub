import { createId } from "@cleanhub/id";
import { sql } from "drizzle-orm";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
} from "drizzle-orm";

import {
  type Database,
  customerAccounts,
  customers,
  orders,
  serviceTickets,
  ticketItems,
} from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import type {
  ListPosCustomersQuery,
  ListPosAccountProfilesResult,
  ListPosCustomerServiceItemsResult,
  PosAccountAuditSnapshot,
  PosCustomerAccountDetail,
  PosCustomerAccountSummary,
  PosCustomerOrderStats,
  PosCustomerProfileDetail,
  PosCustomerProfileWithAccount,
  PosProfileAuditSnapshot,
} from "./customers.types.js";

// ---- helpers --------------------------------------------------------------

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize a phone/email value: trim and drop empty strings so optional
 * fields stay `undefined` rather than leaking "" into unique constraints.
 */
function normalizeOptional(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeSearchQuery(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? `%${trimmed}%` : undefined;
}

// ---- reads: accounts ------------------------------------------------------

export async function findPosAccountById(
  db: Database,
  tenantId: string,
  accountId: string,
): Promise<PosCustomerAccountDetail | null> {
  const rows = await db
    .select({
      id: customerAccounts.id,
      accountName: customerAccounts.accountName,
      phone: customerAccounts.phone,
      email: customerAccounts.email,
      status: customerAccounts.status,
      createdAt: customerAccounts.createdAt,
      updatedAt: customerAccounts.updatedAt,
      version: customerAccounts.version,
    })
    .from(customerAccounts)
    .where(
      and(
        eq(customerAccounts.id, accountId),
        eq(customerAccounts.tenantId, tenantId),
        isNull(customerAccounts.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    accountName: row.accountName,
    phone: row.phone,
    email: row.email,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

export async function findPosAccountByPhone(
  db: Database,
  tenantId: string,
  phone: string,
): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: customerAccounts.id })
    .from(customerAccounts)
    .where(
      and(
        eq(customerAccounts.tenantId, tenantId),
        eq(customerAccounts.phone, phone),
        isNull(customerAccounts.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findPosAccountByEmail(
  db: Database,
  tenantId: string,
  normalizedEmail: string,
): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: customerAccounts.id })
    .from(customerAccounts)
    .where(
      and(
        eq(customerAccounts.tenantId, tenantId),
        eq(customerAccounts.email, normalizedEmail),
        isNull(customerAccounts.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function countActiveProfilesByAccount(
  db: Database,
  tenantId: string,
  accountId: string,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, tenantId),
        eq(customers.customerAccountId, accountId),
        eq(customers.status, "active"),
        isNull(customers.deletedAt),
      ),
    );

  return rows[0]?.value ?? 0;
}

// ---- reads: profiles ------------------------------------------------------

export async function findPosProfileById(
  db: Database,
  tenantId: string,
  customerId: string,
): Promise<PosCustomerProfileDetail | null> {
  const rows = await db
    .select({
      id: customers.id,
      customerAccountId: customers.customerAccountId,
      fullName: customers.fullName,
      phone: customers.phone,
      email: customers.email,
      relationship: customers.relationship,
      address: customers.address,
      notes: customers.notes,
      status: customers.status,
      createdAt: customers.createdAt,
      updatedAt: customers.updatedAt,
      version: customers.version,
    })
    .from(customers)
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.tenantId, tenantId),
        isNull(customers.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    customerAccountId: row.customerAccountId,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    relationship: row.relationship,
    address: row.address,
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

export async function findPosProfilesByAccount(
  db: Database,
  tenantId: string,
  accountId: string,
  query: { q?: string; limit: number; offset: number },
): Promise<ListPosAccountProfilesResult> {
  const searchQuery = normalizeSearchQuery(query.q);
  const where = and(
    eq(customers.tenantId, tenantId),
    eq(customers.customerAccountId, accountId),
    isNull(customers.deletedAt),
    searchQuery
      ? or(
          ilike(customers.fullName, searchQuery),
          ilike(customers.phone, searchQuery),
          ilike(customers.email, searchQuery),
        )
      : undefined,
  );

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: customers.id,
        customerAccountId: customers.customerAccountId,
        fullName: customers.fullName,
        phone: customers.phone,
        email: customers.email,
        status: customers.status,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(where)
      .orderBy(desc(customers.createdAt))
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ value: count() })
      .from(customers)
      .where(where),
  ]);

  return {
    data: rows.map((row) => ({
      id: row.id,
      customerAccountId: row.customerAccountId,
      fullName: row.fullName,
      phone: row.phone,
      email: row.email,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
    total: countRows[0]?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

// ---- reads: hybrid list ---------------------------------------------------

/**
 * Hybrid list per the milestone spec. The search term matches account
 * (accountName/phone/email) or profile (fullName/phone/email). When
 * `resultType` is set only that kind is returned; otherwise accounts and
 * profiles are both fetched and merged by createdAt desc.
 *
 * `total` is the count over the SAME filter set (without limit/offset) so the
 * frontend can render pagination. Because accounts and profiles live in two
 * tables, when resultType is unset total is accountCount + profileCount.
 */
export async function searchPosAccounts(
  db: Database,
  tenantId: string,
  query: ListPosCustomersQuery,
): Promise<{ items: PosCustomerAccountSummary[]; total: number }> {
  const searchQuery = normalizeSearchQuery(query.q);

  const where = and(
    eq(customerAccounts.tenantId, tenantId),
    isNull(customerAccounts.deletedAt),
    query.status ? eq(customerAccounts.status, query.status) : undefined,
    searchQuery
      ? or(
          ilike(customerAccounts.accountName, searchQuery),
          ilike(customerAccounts.phone, searchQuery),
          ilike(customerAccounts.email, searchQuery),
        )
      : undefined,
  );

  const [items, countRows] = await Promise.all([
    db
      .select({
        id: customerAccounts.id,
        accountName: customerAccounts.accountName,
        phone: customerAccounts.phone,
        email: customerAccounts.email,
        status: customerAccounts.status,
        createdAt: customerAccounts.createdAt,
      })
      .from(customerAccounts)
      .where(where)
      .orderBy(desc(customerAccounts.createdAt))
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ value: count() })
      .from(customerAccounts)
      .where(where),
  ]);

  return {
    items: items.map((row) => ({
      id: row.id,
      accountName: row.accountName,
      phone: row.phone,
      email: row.email,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
    total: countRows[0]?.value ?? 0,
  };
}

export async function searchPosProfiles(
  db: Database,
  tenantId: string,
  query: ListPosCustomersQuery,
): Promise<{
  items: PosCustomerProfileWithAccount[];
  total: number;
}> {
  const searchQuery = normalizeSearchQuery(query.q);

  const where = and(
    eq(customers.tenantId, tenantId),
    isNull(customers.deletedAt),
    query.status ? eq(customers.status, query.status) : undefined,
    searchQuery
      ? or(
          ilike(customers.fullName, searchQuery),
          ilike(customers.phone, searchQuery),
          ilike(customers.email, searchQuery),
        )
      : undefined,
  );

  const [items, countRows] = await Promise.all([
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
        and(
          eq(customerAccounts.id, customers.customerAccountId),
          eq(customerAccounts.tenantId, customers.tenantId),
          isNull(customerAccounts.deletedAt),
        ),
      )
      .where(where)
      .orderBy(desc(customers.createdAt))
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ value: count() })
      .from(customers)
      .where(where),
  ]);

  return {
    items: items.map((row) => ({
      id: row.id,
      customerAccountId: row.customerAccountId,
      accountName: row.accountName,
      fullName: row.fullName,
      phone: row.phone,
      email: row.email,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
    total: countRows[0]?.value ?? 0,
  };
}

/**
 * Lightweight count-only query for accounts. Used to report the total account
 * count when the list is filtered to profiles (so the UI always shows both
 * totals).
 */
export async function countPosAccounts(
  db: Database,
  tenantId: string,
  query: Pick<ListPosCustomersQuery, "q" | "status">,
): Promise<number> {
  const searchQuery = normalizeSearchQuery(query.q);
  const where = and(
    eq(customerAccounts.tenantId, tenantId),
    isNull(customerAccounts.deletedAt),
    query.status ? eq(customerAccounts.status, query.status) : undefined,
    searchQuery
      ? or(
          ilike(customerAccounts.accountName, searchQuery),
          ilike(customerAccounts.phone, searchQuery),
          ilike(customerAccounts.email, searchQuery),
        )
      : undefined,
  );
  const rows = await db
    .select({ value: count() })
    .from(customerAccounts)
    .where(where);
  return rows[0]?.value ?? 0;
}

/**
 * Lightweight count-only query for profiles. Used to report the total profile
 * count when the list is filtered to accounts (so the UI always shows both
 * totals).
 */
export async function countPosProfiles(
  db: Database,
  tenantId: string,
  query: Pick<ListPosCustomersQuery, "q" | "status">,
): Promise<number> {
  const searchQuery = normalizeSearchQuery(query.q);
  const where = and(
    eq(customers.tenantId, tenantId),
    isNull(customers.deletedAt),
    query.status ? eq(customers.status, query.status) : undefined,
    searchQuery
      ? or(
          ilike(customers.fullName, searchQuery),
          ilike(customers.phone, searchQuery),
          ilike(customers.email, searchQuery),
        )
      : undefined,
  );
  const rows = await db
    .select({ value: count() })
    .from(customers)
    .where(where);
  return rows[0]?.value ?? 0;
}

export async function findPosCustomerOrderStats(
  db: Database,
  tenantId: string,
  customerId: string,
  allowedBranchIds?: string[],
): Promise<PosCustomerOrderStats> {
  if (allowedBranchIds?.length === 0) {
    return { orderCount: 0, totalPaid: "0" };
  }

  const rows = await db
    .select({
      orderCount: sql<number>`count(${orders.id})::int`,
      totalPaid: sql<string>`coalesce(sum(${orders.paidAmount}), 0)::text`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.customerId, customerId),
        allowedBranchIds ? inArray(orders.branchId, allowedBranchIds) : undefined,
        isNull(orders.deletedAt),
      ),
    );

  return {
    orderCount: rows[0]?.orderCount ?? 0,
    totalPaid: rows[0]?.totalPaid ?? "0",
  };
}

export async function findPosCustomerServiceItems(
  db: Database,
  tenantId: string,
  customerId: string,
  query: {
    q?: string;
    limit: number;
    offset: number;
    allowedBranchIds?: string[];
  },
): Promise<ListPosCustomerServiceItemsResult> {
  if (query.allowedBranchIds?.length === 0) {
    return {
      data: [],
      total: 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  const searchQuery = normalizeSearchQuery(query.q);
  const where = and(
    eq(serviceTickets.tenantId, tenantId),
    inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
    eq(serviceTickets.customerId, customerId),
    query.allowedBranchIds
      ? inArray(serviceTickets.branchId, query.allowedBranchIds)
      : undefined,
    isNull(serviceTickets.deletedAt),
    eq(ticketItems.tenantId, tenantId),
    isNull(ticketItems.deletedAt),
    searchQuery
      ? or(
          ilike(ticketItems.itemName, searchQuery),
          ilike(ticketItems.itemCategory, searchQuery),
          ilike(ticketItems.defectNotes, searchQuery),
          ilike(ticketItems.specialRequest, searchQuery),
          ilike(ticketItems.remark, searchQuery),
          ilike(ticketItems.labelCode, searchQuery),
          ilike(serviceTickets.ticketNo, searchQuery),
        )
      : undefined,
  );

  const [items, countRows] = await Promise.all([
    db
      .select({
        id: ticketItems.id,
        ticketId: ticketItems.ticketId,
        ticketNo: serviceTickets.ticketNo,
        ticketType: serviceTickets.ticketType,
        itemType: ticketItems.itemType,
        itemName: ticketItems.itemName,
        itemCategory: ticketItems.itemCategory,
        itemStatus: ticketItems.itemStatus,
        itemColor: ticketItems.itemColor,
        itemBrand: ticketItems.itemBrand,
        itemMaterial: ticketItems.itemMaterial,
        quantity: ticketItems.quantity,
        pricingUnit: ticketItems.pricingUnit,
        standardUnitAmount: ticketItems.standardUnitAmount,
        chargedUnitAmount: ticketItems.chargedUnitAmount,
        weight: ticketItems.weight,
        bagCount: ticketItems.bagCount,
        unitAmount: ticketItems.unitAmount,
        lineAmount: ticketItems.lineAmount,
        serviceId: ticketItems.serviceId,
        labelCode: ticketItems.labelCode,
        defectNotes: ticketItems.defectNotes,
        specialRequest: ticketItems.specialRequest,
        remark: ticketItems.remark,
        sortOrder: ticketItems.sortOrder,
        createdAt: ticketItems.createdAt,
        updatedAt: ticketItems.updatedAt,
        version: ticketItems.version,
      })
      .from(ticketItems)
      .innerJoin(
        serviceTickets,
        and(
          eq(serviceTickets.id, ticketItems.ticketId),
          eq(serviceTickets.tenantId, ticketItems.tenantId),
        ),
      )
      .where(where)
      .orderBy(desc(ticketItems.createdAt))
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ value: count() })
      .from(ticketItems)
      .innerJoin(
        serviceTickets,
        and(
          eq(serviceTickets.id, ticketItems.ticketId),
          eq(serviceTickets.tenantId, ticketItems.tenantId),
        ),
      )
      .where(where),
  ]);

  return {
    data: items.map((row) => ({
      id: row.id,
      ticketId: row.ticketId,
      ticketNo: row.ticketNo,
      ticketType: row.ticketType,
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
    })),
    total: countRows[0]?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

// ---- writes: accounts -----------------------------------------------------

export type InsertPosAccountInput = {
  id?: string;
  actorUserId: string;
  tenantId: string;
  accountName: string;
  phone?: string;
  email?: string;
};

export async function insertPosAccount(
  db: Database,
  input: InsertPosAccountInput,
): Promise<PosCustomerAccountDetail> {
  const id = input.id ?? createId();
  const phone = normalizeOptional(input.phone);
  const email = input.email ? normalizeEmail(input.email) : undefined;

  const rows = await db
    .insert(customerAccounts)
    .values({
      id,
      tenantId: input.tenantId,
      accountName: input.accountName,
      phone,
      email,
      status: "active",
      createdBy: input.actorUserId,
    })
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

  const row = rows[0]!;

  return {
    id: row.id,
    accountName: row.accountName,
    phone: row.phone,
    email: row.email,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

export type UpdatePosAccountRecordInput = {
  tenantId: string;
  accountId: string;
  actorUserId: string;
  accountName?: string;
  phone?: string | null;
  email?: string | null;
};

export async function updatePosAccountRecord(
  db: Database,
  input: UpdatePosAccountRecordInput,
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy: input.actorUserId };

  if (input.accountName !== undefined) {
    set.accountName = input.accountName;
  }
  if (input.phone !== undefined) {
    const phone = normalizeOptional(input.phone);
    set.phone = phone ?? null;
  }
  if (input.email !== undefined) {
    const email = input.email ? normalizeEmail(input.email) : null;
    set.email = email;
  }
  set.version = sql`${customerAccounts.version} + 1`;

  await db
    .update(customerAccounts)
    .set(set)
    .where(
      and(
        eq(customerAccounts.id, input.accountId),
        eq(customerAccounts.tenantId, input.tenantId),
        isNull(customerAccounts.deletedAt),
      ),
    );
}

export async function setPosAccountStatus(
  db: Database,
  tenantId: string,
  accountId: string,
  actorUserId: string,
  status: "active" | "disabled",
): Promise<void> {
  await db
    .update(customerAccounts)
    .set({
      status,
      updatedAt: new Date(),
      updatedBy: actorUserId,
      version: sql`${customerAccounts.version} + 1`,
    })
    .where(
      and(
        eq(customerAccounts.id, accountId),
        eq(customerAccounts.tenantId, tenantId),
        isNull(customerAccounts.deletedAt),
      ),
    );
}

// ---- writes: profiles -----------------------------------------------------

export type InsertPosProfileInput = {
  id?: string;
  actorUserId: string;
  tenantId: string;
  customerAccountId: string;
  fullName: string;
  phone?: string;
  email?: string;
  relationship?: string;
  address?: string;
  notes?: string;
};

export async function insertPosProfile(
  db: Database,
  input: InsertPosProfileInput,
): Promise<PosCustomerProfileDetail> {
  const id = input.id ?? createId();
  const phone = normalizeOptional(input.phone);
  const email = input.email ? normalizeEmail(input.email) : undefined;

  const rows = await db
    .insert(customers)
    .values({
      id,
      customerAccountId: input.customerAccountId,
      tenantId: input.tenantId,
      fullName: input.fullName,
      phone,
      email,
      relationship: normalizeOptional(input.relationship),
      address: normalizeOptional(input.address),
      notes: normalizeOptional(input.notes),
      status: "active",
      createdBy: input.actorUserId,
    })
    .returning({
      id: customers.id,
      customerAccountId: customers.customerAccountId,
      fullName: customers.fullName,
      phone: customers.phone,
      email: customers.email,
      relationship: customers.relationship,
      address: customers.address,
      notes: customers.notes,
      status: customers.status,
      createdAt: customers.createdAt,
      updatedAt: customers.updatedAt,
      version: customers.version,
    });

  const row = rows[0]!;

  return {
    id: row.id,
    customerAccountId: row.customerAccountId,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    relationship: row.relationship,
    address: row.address,
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

export type UpdatePosProfileRecordInput = {
  tenantId: string;
  customerId: string;
  actorUserId: string;
  fullName?: string;
  phone?: string | null;
  email?: string | null;
  relationship?: string | null;
  address?: string | null;
  notes?: string | null;
};

export async function updatePosProfileRecord(
  db: Database,
  input: UpdatePosProfileRecordInput,
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy: input.actorUserId };

  if (input.fullName !== undefined) {
    set.fullName = input.fullName;
  }
  if (input.phone !== undefined) {
    const phone = normalizeOptional(input.phone);
    set.phone = phone ?? null;
  }
  if (input.email !== undefined) {
    const email = input.email ? normalizeEmail(input.email) : null;
    set.email = email;
  }
  if (input.relationship !== undefined) {
    set.relationship = normalizeOptional(input.relationship) ?? null;
  }
  if (input.address !== undefined) {
    set.address = normalizeOptional(input.address) ?? null;
  }
  if (input.notes !== undefined) {
    set.notes = normalizeOptional(input.notes) ?? null;
  }
  set.version = sql`${customers.version} + 1`;

  await db
    .update(customers)
    .set(set)
    .where(
      and(
        eq(customers.id, input.customerId),
        eq(customers.tenantId, input.tenantId),
        isNull(customers.deletedAt),
      ),
    );
}

export async function setPosProfileStatus(
  db: Database,
  tenantId: string,
  customerId: string,
  actorUserId: string,
  status: "active" | "disabled",
): Promise<void> {
  await db
    .update(customers)
    .set({
      status,
      updatedAt: new Date(),
      updatedBy: actorUserId,
      version: sql`${customers.version} + 1`,
    })
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.tenantId, tenantId),
        isNull(customers.deletedAt),
      ),
    );
}

// ---- soft delete (never hard delete) -------------------------------------

/**
 * Soft delete one account: stamps deleted_at/deleted_by. Does NOT touch its
 * profiles; cascadeProfilesSoftDelete must be called separately so both
 * operations carry the actor id consistently.
 */
export async function softDeletePosAccount(
  db: Database,
  tenantId: string,
  accountId: string,
  actorUserId: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(customerAccounts)
    .set({ deletedAt: now, deletedBy: actorUserId, updatedAt: now, updatedBy: actorUserId })
    .where(
      and(
        eq(customerAccounts.id, accountId),
        eq(customerAccounts.tenantId, tenantId),
        isNull(customerAccounts.deletedAt),
      ),
    );
}

/**
 * Cascade soft delete every non-deleted profile under an account.
 */
export async function cascadeSoftDeleteProfilesByAccount(
  db: Database,
  tenantId: string,
  accountId: string,
  actorUserId: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(customers)
    .set({ deletedAt: now, deletedBy: actorUserId, updatedAt: now, updatedBy: actorUserId })
    .where(
      and(
        eq(customers.tenantId, tenantId),
        eq(customers.customerAccountId, accountId),
        isNull(customers.deletedAt),
      ),
    );
}

export async function softDeletePosProfile(
  db: Database,
  tenantId: string,
  customerId: string,
  actorUserId: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(customers)
    .set({ deletedAt: now, deletedBy: actorUserId, updatedAt: now, updatedBy: actorUserId })
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.tenantId, tenantId),
        isNull(customers.deletedAt),
      ),
    );
}

// ---- audit snapshots + logs ----------------------------------------------

export async function findPosAccountAuditSnapshot(
  db: Database,
  tenantId: string,
  accountId: string,
): Promise<PosAccountAuditSnapshot | null> {
  const account = await findPosAccountById(db, tenantId, accountId);
  if (!account) {
    return null;
  }

  return {
    accountName: account.accountName,
    phone: account.phone,
    email: account.email,
    status: account.status,
  };
}

export async function findPosProfileAuditSnapshot(
  db: Database,
  tenantId: string,
  customerId: string,
): Promise<PosProfileAuditSnapshot | null> {
  const profile = await findPosProfileById(db, tenantId, customerId);
  if (!profile) {
    return null;
  }

  return {
    customerAccountId: profile.customerAccountId,
    fullName: profile.fullName,
    phone: profile.phone,
    email: profile.email,
    relationship: profile.relationship,
    address: profile.address,
    notes: profile.notes,
    status: profile.status,
  };
}

export async function writePosAccountAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    tenantId: string;
    accountId: string;
    eventType: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    reason?: string;
    branchId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    branchId: input.branchId,
    actorUserId: input.actorUserId,
    eventCategory: "pos_customer",
    eventType: input.eventType,
    entityType: "customer_account",
    entityId: input.accountId,
    success: true,
    reason: input.reason,
    metadata: input.metadata,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    before: input.before ?? undefined,
    after: input.after ?? undefined,
  });
}

export async function writePosProfileAuditLog(
  db: Database,
  input: {
    actorUserId: string;
    tenantId: string;
    customerId: string;
    eventType: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    reason?: string;
    branchId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await writeAuditLog(db, {
    tenantId: input.tenantId,
    branchId: input.branchId,
    actorUserId: input.actorUserId,
    eventCategory: "pos_customer",
    eventType: input.eventType,
    entityType: "customer",
    entityId: input.customerId,
    success: true,
    reason: input.reason,
    metadata: input.metadata,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    before: input.before ?? undefined,
    after: input.after ?? undefined,
  });
}
