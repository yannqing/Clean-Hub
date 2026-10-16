import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { createId } from "@cleanhub/id";
import { products, services, taxRates, type Database } from "@cleanhub/db";

import type {
  CreateTenantTaxRateRequest,
  TenantTaxRate,
  UpdateTenantTaxRateRequest,
} from "./tax-rates.types.js";

type TaxRateRow = typeof taxRates.$inferSelect;

function toTenantTaxRate(
  row: TaxRateRow,
  usage: { serviceCount: number; productCount: number },
): TenantTaxRate {
  return {
    id: row.id,
    name: row.name,
    rate: row.rate,
    displayOrder: row.displayOrder,
    archived: row.archivedAt !== null,
    serviceCount: usage.serviceCount,
    productCount: usage.productCount,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function countUsage(
  db: Database,
  tenantId: string,
): Promise<Map<string, { serviceCount: number; productCount: number }>> {
  const serviceRows = await db
    .select({ taxRateId: services.taxRateId, count: sql<number>`count(*)::int` })
    .from(services)
    .where(and(eq(services.tenantId, tenantId), isNull(services.deletedAt)))
    .groupBy(services.taxRateId);
  const productRows = await db
    .select({ taxRateId: products.taxRateId, count: sql<number>`count(*)::int` })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), isNull(products.deletedAt)))
    .groupBy(products.taxRateId);
  const usage = new Map<string, { serviceCount: number; productCount: number }>();
  for (const row of serviceRows) {
    if (!row.taxRateId) continue;
    const current = usage.get(row.taxRateId) ?? { serviceCount: 0, productCount: 0 };
    usage.set(row.taxRateId, { ...current, serviceCount: row.count });
  }
  for (const row of productRows) {
    if (!row.taxRateId) continue;
    const current = usage.get(row.taxRateId) ?? { serviceCount: 0, productCount: 0 };
    usage.set(row.taxRateId, { ...current, productCount: row.count });
  }
  return usage;
}

const NO_USAGE = { serviceCount: 0, productCount: 0 };

export async function findTenantTaxRates(
  db: Database,
  input: { tenantId: string; includeArchived: boolean },
): Promise<TenantTaxRate[]> {
  const conditions = [
    eq(taxRates.tenantId, input.tenantId),
    isNull(taxRates.deletedAt),
  ];
  if (!input.includeArchived) conditions.push(isNull(taxRates.archivedAt));

  const rows = await db
    .select()
    .from(taxRates)
    .where(and(...conditions))
    .orderBy(asc(taxRates.displayOrder), asc(taxRates.name));
  const usage = await countUsage(db, input.tenantId);
  return rows.map((row) => toTenantTaxRate(row, usage.get(row.id) ?? NO_USAGE));
}

export async function findTenantTaxRateById(
  db: Database,
  input: { tenantId: string; taxRateId: string },
): Promise<TenantTaxRate | null> {
  const rows = await db
    .select()
    .from(taxRates)
    .where(
      and(
        eq(taxRates.tenantId, input.tenantId),
        eq(taxRates.id, input.taxRateId),
        isNull(taxRates.deletedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const usage = await countUsage(db, input.tenantId);
  return toTenantTaxRate(row, usage.get(row.id) ?? NO_USAGE);
}

export async function insertTenantTaxRate(
  db: Database,
  input: {
    tenantId: string;
    actorUserId: string;
    data: CreateTenantTaxRateRequest;
  },
): Promise<TenantTaxRate> {
  const rows = await db
    .insert(taxRates)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      name: input.data.name,
      rate: input.data.rate,
      displayOrder: input.data.displayOrder ?? 0,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })
    .returning();
  return toTenantTaxRate(rows[0]!, NO_USAGE);
}

/** Returns null when the row changed since `expectedVersion` was read. */
export async function updateTenantTaxRateRecord(
  db: Database,
  input: {
    tenantId: string;
    taxRateId: string;
    actorUserId: string;
    data: UpdateTenantTaxRateRequest;
  },
): Promise<TenantTaxRate | null> {
  const archivedAt =
    input.data.archived === undefined
      ? undefined
      : input.data.archived
        ? new Date()
        : null;
  const rows = await db
    .update(taxRates)
    .set({
      ...(input.data.name !== undefined ? { name: input.data.name } : {}),
      ...(input.data.rate !== undefined ? { rate: input.data.rate } : {}),
      ...(input.data.displayOrder !== undefined
        ? { displayOrder: input.data.displayOrder }
        : {}),
      ...(archivedAt !== undefined ? { archivedAt } : {}),
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${taxRates.version} + 1`,
    })
    .where(
      and(
        eq(taxRates.tenantId, input.tenantId),
        eq(taxRates.id, input.taxRateId),
        eq(taxRates.version, input.data.expectedVersion),
        isNull(taxRates.deletedAt),
      ),
    )
    .returning();
  const row = rows[0];
  if (!row) return null;
  const usage = await countUsage(db, input.tenantId);
  return toTenantTaxRate(row, usage.get(row.id) ?? NO_USAGE);
}

export async function softDeleteTenantTaxRate(
  db: Database,
  input: { tenantId: string; taxRateId: string; actorUserId: string },
): Promise<void> {
  await db
    .update(taxRates)
    .set({
      deletedAt: new Date(),
      deletedBy: input.actorUserId,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${taxRates.version} + 1`,
    })
    .where(
      and(
        eq(taxRates.tenantId, input.tenantId),
        eq(taxRates.id, input.taxRateId),
        isNull(taxRates.deletedAt),
      ),
    );
}

export function isTaxRateNameUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  return (
    typeof cause === "object" &&
    cause !== null &&
    (cause as { code?: string }).code === "23505" &&
    String((cause as { constraint?: string }).constraint ?? "").includes(
      "tax_rates_active_name_unique",
    )
  );
}
