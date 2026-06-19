import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";

import { prices, services, type Database } from "@cleanhub/db";

import { TenantPricesError } from "./prices.errors.js";
import type {
  PriceAuditSnapshot,
  PriceListInput,
  PriceSummary,
  UpdatePriceRequest,
} from "./prices.types.js";

type PriceJoinedRow = {
  id: string;
  tenantId: string;
  serviceId: string;
  serviceName: string;
  businessLine: PriceSummary["businessLine"];
  amount: string;
  currency: string;
  status: PriceSummary["status"];
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function toPriceSummary(row: PriceJoinedRow): PriceSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    businessLine: row.businessLine,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

function toAuditSnapshot(row: PriceSummary): PriceAuditSnapshot {
  return {
    tenantId: row.tenantId,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    businessLine: row.businessLine,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
  };
}

function buildPriceSelect() {
  return {
    id: prices.id,
    tenantId: prices.tenantId,
    serviceId: prices.serviceId,
    serviceName: services.name,
    businessLine: services.businessLine,
    amount: prices.amount,
    currency: prices.currency,
    status: prices.status,
    createdAt: prices.createdAt,
    updatedAt: prices.updatedAt,
    version: prices.version,
  };
}

export async function findPrices(
  db: Database,
  input: PriceListInput & { tenantId: string },
): Promise<PriceSummary[]> {
  const filters: SQL[] = [
    eq(prices.tenantId, input.tenantId),
    isNull(prices.deletedAt),
    isNull(services.deletedAt),
  ];

  if (input.businessLine) {
    filters.push(eq(services.businessLine, input.businessLine));
  }

  if (input.status) {
    filters.push(eq(prices.status, input.status));
  }

  if (input.q) {
    const query = `%${escapeLikePattern(input.q)}%`;
    filters.push(sql`${services.name} ilike ${query} escape '\\'`);
  }

  const rows = await db
    .select(buildPriceSelect())
    .from(prices)
    .innerJoin(services, eq(services.id, prices.serviceId))
    .where(and(...filters))
    .orderBy(asc(services.name))
    .limit(input.limit)
    .offset(input.offset);

  return rows.map(toPriceSummary);
}

export async function findPriceById(
  db: Database,
  input: { tenantId: string; priceId: string },
): Promise<PriceSummary | null> {
  const rows = await db
    .select(buildPriceSelect())
    .from(prices)
    .innerJoin(services, eq(services.id, prices.serviceId))
    .where(
      and(
        eq(prices.id, input.priceId),
        eq(prices.tenantId, input.tenantId),
        isNull(prices.deletedAt),
        isNull(services.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ? toPriceSummary(rows[0]) : null;
}

export async function findPriceAuditSnapshotById(
  db: Database,
  input: { tenantId: string; priceId: string },
): Promise<PriceAuditSnapshot | null> {
  const price = await findPriceById(db, input);

  return price ? toAuditSnapshot(price) : null;
}

export async function updatePriceRecord(
  db: Database,
  input: UpdatePriceRequest & {
    tenantId: string;
    priceId: string;
    actorUserId: string;
  },
): Promise<PriceSummary | null> {
  const existing = await findPriceById(db, input);

  if (!existing) {
    return null;
  }

  const updatedRows = await db
    .update(prices)
    .set({
      amount: input.amount ?? existing.amount,
      currency: input.currency?.trim().toUpperCase() ?? existing.currency,
      status: input.status ?? existing.status,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${prices.version} + 1`,
    })
    .where(
      and(
        eq(prices.id, input.priceId),
        eq(prices.tenantId, input.tenantId),
        isNull(prices.deletedAt),
      ),
    )
    .returning({ id: prices.id });

  if (!updatedRows[0]) {
    throw new TenantPricesError(
      "PRICE_NOT_FOUND",
      "Price was not found.",
      404,
    );
  }

  return findPriceById(db, input);
}
