import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";

import {
  prices,
  serviceCategories,
  services,
  tenantSettings,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type {
  CreateServiceRequest,
  ServiceAuditSnapshot,
  ServiceListInput,
  ServicePriceAuditSnapshot,
  ServiceStatus,
  ServiceSummary,
  UpdateServiceRequest,
} from "./services.types.js";
import { TenantServicesError } from "./services.errors.js";

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

type ServiceJoinedRow = {
  id: string;
  tenantId: string;
  businessLine: ServiceSummary["businessLine"];
  name: string;
  categoryId: string | null;
  categoryName: string;
  description: string | null;
  displayOrder: number;
  pricingUnit: ServiceSummary["pricingUnit"];
  labelRule: ServiceSummary["labelRule"];
  standardPrice: string;
  currency: string;
  status: ServiceSummary["status"];
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

function buildServiceSelect() {
  return {
    id: services.id,
    tenantId: services.tenantId,
    businessLine: services.businessLine,
    name: services.name,
    categoryId: services.categoryId,
    categoryName: serviceCategories.name,
    description: services.description,
    displayOrder: services.displayOrder,
    pricingUnit: services.pricingUnit,
    labelRule: services.labelRule,
    standardPrice: prices.amount,
    currency: prices.currency,
    status: services.status,
    createdAt: services.createdAt,
    updatedAt: services.updatedAt,
    version: services.version,
  };
}

function toServiceSummary(row: ServiceJoinedRow): ServiceSummary {
  if (!row.categoryId) {
    throw new Error(`Service "${row.id}" has no category.`);
  }

  return {
    id: row.id,
    tenantId: row.tenantId,
    businessLine: row.businessLine,
    name: row.name,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    description: row.description,
    displayOrder: row.displayOrder,
    pricingUnit: row.pricingUnit,
    labelRule: row.labelRule,
    standardPrice: row.standardPrice,
    currency: row.currency,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

function toAuditSnapshot(row: ServiceSummary): ServiceAuditSnapshot {
  return {
    tenantId: row.tenantId,
    businessLine: row.businessLine,
    name: row.name,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    description: row.description,
    displayOrder: row.displayOrder,
    pricingUnit: row.pricingUnit,
    labelRule: row.labelRule,
    standardPrice: row.standardPrice,
    currency: row.currency,
    status: row.status,
  };
}

export async function findServices(
  db: Database,
  input: ServiceListInput & { tenantId: string },
): Promise<ServiceSummary[]> {
  const filters: SQL[] = [
    eq(services.tenantId, input.tenantId),
    isNull(services.deletedAt),
    isNull(serviceCategories.deletedAt),
    isNull(prices.deletedAt),
  ];

  if (input.businessLine) {
    filters.push(eq(services.businessLine, input.businessLine));
  }

  if (input.status) {
    filters.push(eq(services.status, input.status));
  }

  if (input.q) {
    const query = `%${escapeLikePattern(input.q)}%`;
    filters.push(sql`${services.name} ilike ${query} escape '\\'`);
  }

  const rows = await db
    .select(buildServiceSelect())
    .from(services)
    .innerJoin(
      serviceCategories,
      and(
        eq(serviceCategories.id, services.categoryId),
        eq(serviceCategories.tenantId, services.tenantId),
      ),
    )
    .innerJoin(
      prices,
      and(
        eq(prices.serviceId, services.id),
        eq(prices.tenantId, services.tenantId),
      ),
    )
    .where(and(...filters))
    .orderBy(
      asc(serviceCategories.sortOrder),
      asc(services.displayOrder),
      asc(services.name),
      asc(services.id),
    )
    .limit(input.limit)
    .offset(input.offset);

  return rows.map(toServiceSummary);
}

export async function findServiceById(
  db: Database,
  input: { tenantId: string; serviceId: string },
): Promise<ServiceSummary | null> {
  const rows = await db
    .select(buildServiceSelect())
    .from(services)
    .innerJoin(
      serviceCategories,
      and(
        eq(serviceCategories.id, services.categoryId),
        eq(serviceCategories.tenantId, services.tenantId),
      ),
    )
    .innerJoin(
      prices,
      and(
        eq(prices.serviceId, services.id),
        eq(prices.tenantId, services.tenantId),
      ),
    )
    .where(
      and(
        eq(services.id, input.serviceId),
        eq(services.tenantId, input.tenantId),
        isNull(services.deletedAt),
        isNull(serviceCategories.deletedAt),
        isNull(prices.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ? toServiceSummary(rows[0]) : null;
}

export async function findServiceAuditSnapshotById(
  db: Database,
  input: { tenantId: string; serviceId: string },
): Promise<ServiceAuditSnapshot | null> {
  const service = await findServiceById(db, input);

  return service ? toAuditSnapshot(service) : null;
}

export async function findServicePriceAuditSnapshotByServiceId(
  db: Database,
  input: { tenantId: string; serviceId: string },
): Promise<ServicePriceAuditSnapshot | null> {
  const rows = await db
    .select({
      id: prices.id,
      tenantId: prices.tenantId,
      serviceId: prices.serviceId,
      serviceName: services.name,
      businessLine: services.businessLine,
      amount: prices.amount,
      currency: prices.currency,
      status: prices.status,
    })
    .from(prices)
    .innerJoin(
      services,
      and(
        eq(services.id, prices.serviceId),
        eq(services.tenantId, prices.tenantId),
      ),
    )
    .where(
      and(
        eq(prices.tenantId, input.tenantId),
        eq(prices.serviceId, input.serviceId),
        isNull(prices.deletedAt),
        isNull(services.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findServiceByName(
  db: Database,
  input: { tenantId: string; name: string; excludeServiceId?: string },
): Promise<{ id: string } | null> {
  const filters: SQL[] = [
    eq(services.tenantId, input.tenantId),
    sql`lower(${services.name}) = lower(${input.name.trim()})`,
    isNull(services.deletedAt),
  ];

  if (input.excludeServiceId) {
    filters.push(sql`${services.id} <> ${input.excludeServiceId}`);
  }

  const rows = await db
    .select({ id: services.id })
    .from(services)
    .where(and(...filters))
    .limit(1);

  return rows[0] ?? null;
}

export async function createServiceRecord(
  db: Database,
  input: CreateServiceRequest & { tenantId: string; actorUserId: string },
): Promise<ServiceSummary> {
  const serviceId = createId();
  const currencyRows = await db
    .select({ currency: tenantSettings.defaultCurrency })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, input.tenantId))
    .limit(1);
  const currency = currencyRows[0]?.currency ?? "XOF";

  await db.insert(services).values({
    id: serviceId,
    tenantId: input.tenantId,
    businessLine: input.businessLine,
    name: input.name.trim(),
    categoryId: input.categoryId,
    description: normalizeNullable(input.description),
    displayOrder: input.displayOrder ?? 0,
    pricingUnit: input.pricingUnit,
    labelRule: input.labelRule,
    status: input.status ?? "active",
    createdBy: input.actorUserId,
    updatedBy: input.actorUserId,
  });

  await db.insert(prices).values({
    id: createId(),
    tenantId: input.tenantId,
    serviceId,
    amount: input.standardPrice,
    currency,
    status: input.status ?? "active",
    createdBy: input.actorUserId,
    updatedBy: input.actorUserId,
  });

  const service = await findServiceById(db, {
    tenantId: input.tenantId,
    serviceId,
  });

  if (!service) {
    throw new Error("Created service could not be loaded.");
  }

  return service;
}

export async function updateServiceRecord(
  db: Database,
  input: UpdateServiceRequest & {
    tenantId: string;
    serviceId: string;
    actorUserId: string;
  },
): Promise<ServiceSummary | null> {
  const existing = await findServiceById(db, input);

  if (!existing) {
    return null;
  }

  const updatedRows = await db
    .update(services)
    .set({
      businessLine: input.businessLine ?? existing.businessLine,
      name: input.name?.trim() ?? existing.name,
      categoryId:
        input.categoryId === undefined ? existing.categoryId : input.categoryId,
      description:
        input.description === undefined
          ? existing.description
          : normalizeNullable(input.description),
      displayOrder: input.displayOrder ?? existing.displayOrder,
      pricingUnit: input.pricingUnit ?? existing.pricingUnit,
      labelRule: input.labelRule ?? existing.labelRule,
      status: input.status ?? existing.status,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${services.version} + 1`,
    })
    .where(
      and(
        eq(services.id, input.serviceId),
        eq(services.tenantId, input.tenantId),
        eq(services.version, input.version),
        isNull(services.deletedAt),
      ),
    )
    .returning({ id: services.id });

  if (!updatedRows[0]) {
    throw new TenantServicesError(
      "SERVICE_VERSION_CONFLICT",
      "Service has been modified. Refresh and try again.",
      409,
    );
  }

  if (
    input.standardPrice !== undefined ||
    input.currency !== undefined ||
    input.status !== undefined
  ) {
    const updatedPriceRows = await db
      .update(prices)
      .set({
        amount: input.standardPrice ?? existing.standardPrice,
        currency: input.currency ?? existing.currency,
        status: input.status ?? existing.status,
        updatedAt: new Date(),
        updatedBy: input.actorUserId,
        version: sql`${prices.version} + 1`,
      })
      .where(
        and(
          eq(prices.serviceId, input.serviceId),
          eq(prices.tenantId, input.tenantId),
          isNull(prices.deletedAt),
        ),
      )
      .returning({ id: prices.id });

    if (!updatedPriceRows[0]) {
      throw new TenantServicesError(
        "SERVICE_NOT_FOUND",
        "The service price was not found.",
        404,
      );
    }
  }

  return findServiceById(db, input);
}

export async function updateServiceStatusRecord(
  db: Database,
  input: {
    tenantId: string;
    serviceId: string;
    status: ServiceStatus;
    actorUserId: string;
    version: number;
  },
): Promise<ServiceSummary | null> {
  const updatedRows = await db
    .update(services)
    .set({
      status: input.status,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${services.version} + 1`,
    })
    .where(
      and(
        eq(services.id, input.serviceId),
        eq(services.tenantId, input.tenantId),
        eq(services.version, input.version),
        isNull(services.deletedAt),
      ),
    )
    .returning({ id: services.id });

  if (!updatedRows[0]) {
    throw new TenantServicesError(
      "SERVICE_VERSION_CONFLICT",
      "Service has been modified. Refresh and try again.",
      409,
    );
  }

  await db
    .update(prices)
    .set({
      status: input.status,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${prices.version} + 1`,
    })
    .where(
      and(
        eq(prices.serviceId, input.serviceId),
        eq(prices.tenantId, input.tenantId),
        isNull(prices.deletedAt),
      ),
    );

  return findServiceById(db, input);
}

export async function softDeleteServiceRecord(
  db: Database,
  input: { tenantId: string; serviceId: string; actorUserId: string },
): Promise<boolean> {
  const updatedRows = await db
    .update(services)
    .set({
      deletedAt: new Date(),
      deletedBy: input.actorUserId,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${services.version} + 1`,
    })
    .where(
      and(
        eq(services.id, input.serviceId),
        eq(services.tenantId, input.tenantId),
        isNull(services.deletedAt),
      ),
    )
    .returning({ id: services.id });

  return Boolean(updatedRows[0]);
}
