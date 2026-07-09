import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";

import { prices, services, type Database } from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type {
  CreateServiceRequest,
  ServiceAuditSnapshot,
  ServiceListInput,
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

function toServiceSummary(row: typeof services.$inferSelect): ServiceSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    businessLine: row.businessLine,
    name: row.name,
    categoryId: row.categoryId,
    pricingUnit: row.pricingUnit,
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
    pricingUnit: row.pricingUnit,
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
    .select()
    .from(services)
    .where(and(...filters))
    .orderBy(asc(services.name))
    .limit(input.limit)
    .offset(input.offset);

  return rows.map(toServiceSummary);
}

export async function findServiceById(
  db: Database,
  input: { tenantId: string; serviceId: string },
): Promise<ServiceSummary | null> {
  const rows = await db
    .select()
    .from(services)
    .where(
      and(
        eq(services.id, input.serviceId),
        eq(services.tenantId, input.tenantId),
        isNull(services.deletedAt),
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

  await db.insert(services).values({
    id: serviceId,
    tenantId: input.tenantId,
    businessLine: input.businessLine,
    name: input.name.trim(),
    categoryId: normalizeNullable(input.categoryId),
    pricingUnit: input.pricingUnit,
    status: input.status ?? "active",
    createdBy: input.actorUserId,
    updatedBy: input.actorUserId,
  });

  await db.insert(prices).values({
    id: createId(),
    tenantId: input.tenantId,
    serviceId,
    amount: "1.00",
    currency: "XOF",
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
        input.categoryId === undefined
          ? existing.categoryId
          : normalizeNullable(input.categoryId),
      pricingUnit: input.pricingUnit ?? existing.pricingUnit,
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
