import { and, eq, isNull, type SQL, sql } from "drizzle-orm";

import { tenantFeatureFlags, tenants, type Database } from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type {
  CreatePriceBookRequest,
  PriceBookAuditSnapshot,
  PriceBookListInput,
  PriceBookSummary,
  PriceBusinessLine,
  UpdatePriceBookRequest,
} from "./prices.types.js";

type PriceBookRow = {
  id: string;
  tenantId: string;
  businessLine: PriceBusinessLine;
  name: string;
  currency: string;
  status: "active" | "disabled" | "draft";
  branchId: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

type TenantAccessRow = {
  tenantId: string;
  status: "active" | "suspended" | "disabled";
  laundryEnabled: boolean | null;
  carWashEnabled: boolean | null;
  retailProductsEnabled: boolean | null;
};

type QueryResult<T> = {
  rows: T[];
};

function toIsoDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toPriceBookSummary(row: PriceBookRow): PriceBookSummary {
  return {
    ...row,
    effectiveFrom: toIsoDate(row.effectiveFrom),
    effectiveTo: toIsoDate(row.effectiveTo),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAuditSnapshot(row: PriceBookSummary): PriceBookAuditSnapshot {
  return {
    tenantId: row.tenantId,
    businessLine: row.businessLine,
    name: row.name,
    currency: row.currency,
    status: row.status,
    branchId: row.branchId,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    sortOrder: row.sortOrder,
  };
}

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

export async function findTenantAccessById(
  db: Database,
  tenantId: string,
): Promise<TenantAccessRow | null> {
  const rows = await db
    .select({
      tenantId: tenants.id,
      status: tenants.status,
      laundryEnabled: tenantFeatureFlags.laundryEnabled,
      carWashEnabled: tenantFeatureFlags.carWashEnabled,
      retailProductsEnabled: tenantFeatureFlags.retailProductsEnabled,
    })
    .from(tenants)
    .leftJoin(tenantFeatureFlags, eq(tenantFeatureFlags.tenantId, tenants.id))
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

export async function findPriceBooks(
  db: Database,
  input: PriceBookListInput & { tenantId: string },
): Promise<PriceBookSummary[]> {
  const filters: SQL[] = [
    sql`tenant_id = ${input.tenantId}`,
    sql`deleted_at is null`,
  ];

  if (input.businessLine) {
    filters.push(sql`business_line = ${input.businessLine}`);
  }

  if (input.status) {
    filters.push(sql`status = ${input.status}`);
  }

  if (input.branchId) {
    filters.push(sql`branch_id = ${input.branchId}`);
  }

  if (input.q) {
    filters.push(sql`name ilike ${`%${input.q}%`}`);
  }

  const result = (await db.execute(sql`
    select
      id,
      tenant_id as "tenantId",
      business_line as "businessLine",
      name,
      currency,
      status,
      branch_id as "branchId",
      effective_from as "effectiveFrom",
      effective_to as "effectiveTo",
      sort_order as "sortOrder",
      created_at as "createdAt",
      updated_at as "updatedAt",
      version
    from price_books
    where ${sql.join(filters, sql` and `)}
    order by sort_order asc, name asc
    limit ${input.limit}
    offset ${input.offset}
  `)) as unknown as QueryResult<PriceBookRow>;

  return result.rows.map(toPriceBookSummary);
}

export async function findPriceBookById(
  db: Database,
  input: { tenantId: string; priceBookId: string },
): Promise<PriceBookSummary | null> {
  const result = (await db.execute(sql`
    select
      id,
      tenant_id as "tenantId",
      business_line as "businessLine",
      name,
      currency,
      status,
      branch_id as "branchId",
      effective_from as "effectiveFrom",
      effective_to as "effectiveTo",
      sort_order as "sortOrder",
      created_at as "createdAt",
      updated_at as "updatedAt",
      version
    from price_books
    where id = ${input.priceBookId}
      and tenant_id = ${input.tenantId}
      and deleted_at is null
    limit 1
  `)) as unknown as QueryResult<PriceBookRow>;

  const row = result.rows[0];

  return row ? toPriceBookSummary(row) : null;
}

export async function findPriceBookAuditSnapshotById(
  db: Database,
  input: { tenantId: string; priceBookId: string },
): Promise<PriceBookAuditSnapshot | null> {
  const priceBook = await findPriceBookById(db, input);

  return priceBook ? toAuditSnapshot(priceBook) : null;
}

export async function findPriceBookByName(
  db: Database,
  input: { tenantId: string; name: string; excludePriceBookId?: string },
): Promise<{ id: string } | null> {
  const result = (await db.execute(sql`
    select id
    from price_books
    where tenant_id = ${input.tenantId}
      and lower(name) = lower(${input.name})
      and deleted_at is null
      and (${input.excludePriceBookId ?? null}::varchar is null or id <> ${input.excludePriceBookId ?? null})
    limit 1
  `)) as unknown as QueryResult<{ id: string }>;

  return result.rows[0] ?? null;
}

export async function createPriceBookRecord(
  db: Database,
  input: CreatePriceBookRequest & { tenantId: string; actorUserId: string },
): Promise<PriceBookSummary> {
  const priceBookId = createId();
  const now = new Date();

  await db.execute(sql`
    insert into price_books (
      id,
      tenant_id,
      business_line,
      name,
      currency,
      status,
      branch_id,
      effective_from,
      effective_to,
      sort_order,
      created_at,
      updated_at,
      created_by,
      updated_by,
      version
    )
    values (
      ${priceBookId},
      ${input.tenantId},
      ${input.businessLine},
      ${input.name.trim()},
      ${input.currency.trim().toUpperCase()},
      ${input.status ?? "draft"},
      ${normalizeNullable(input.branchId)},
      ${normalizeNullable(input.effectiveFrom)},
      ${normalizeNullable(input.effectiveTo)},
      ${input.sortOrder ?? 0},
      ${now},
      ${now},
      ${input.actorUserId},
      ${input.actorUserId},
      1
    )
  `);

  const priceBook = await findPriceBookById(db, {
    tenantId: input.tenantId,
    priceBookId,
  });

  if (!priceBook) {
    throw new Error("Created price book could not be loaded.");
  }

  return priceBook;
}

export async function updatePriceBookRecord(
  db: Database,
  input: UpdatePriceBookRequest & {
    tenantId: string;
    priceBookId: string;
    actorUserId: string;
  },
): Promise<PriceBookSummary | null> {
  const existing = await findPriceBookById(db, input);

  if (!existing) {
    return null;
  }

  const next = {
    businessLine: input.businessLine ?? existing.businessLine,
    name: input.name?.trim() ?? existing.name,
    currency: input.currency?.trim().toUpperCase() ?? existing.currency,
    status: input.status ?? existing.status,
    branchId:
      typeof input.branchId === "undefined"
        ? existing.branchId
        : normalizeNullable(input.branchId),
    effectiveFrom:
      typeof input.effectiveFrom === "undefined"
        ? existing.effectiveFrom
        : normalizeNullable(input.effectiveFrom),
    effectiveTo:
      typeof input.effectiveTo === "undefined"
        ? existing.effectiveTo
        : normalizeNullable(input.effectiveTo),
    sortOrder: input.sortOrder ?? existing.sortOrder,
  };
  const now = new Date();

  await db.execute(sql`
    update price_books
    set
      business_line = ${next.businessLine},
      name = ${next.name},
      currency = ${next.currency},
      status = ${next.status},
      branch_id = ${next.branchId},
      effective_from = ${next.effectiveFrom},
      effective_to = ${next.effectiveTo},
      sort_order = ${next.sortOrder},
      updated_at = ${now},
      updated_by = ${input.actorUserId},
      version = version + 1
    where id = ${input.priceBookId}
      and tenant_id = ${input.tenantId}
      and deleted_at is null
  `);

  return findPriceBookById(db, input);
}

export async function softDeletePriceBookRecord(
  db: Database,
  input: { tenantId: string; priceBookId: string; actorUserId: string },
): Promise<boolean> {
  const now = new Date();
  const result = (await db.execute(sql`
    update price_books
    set
      deleted_at = ${now},
      deleted_by = ${input.actorUserId},
      updated_at = ${now},
      updated_by = ${input.actorUserId},
      version = version + 1
    where id = ${input.priceBookId}
      and tenant_id = ${input.tenantId}
      and deleted_at is null
    returning id
  `)) as unknown as QueryResult<{ id: string }>;

  return Boolean(result.rows[0]);
}
