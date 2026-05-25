import { and, eq, isNull, type SQL, sql } from "drizzle-orm";

import {
  tenantFeatureFlags,
  tenants,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type {
  CreateServiceRequest,
  ServiceAuditSnapshot,
  ServiceBusinessLine,
  ServiceListInput,
  ServiceStatus,
  ServiceSummary,
  UpdateServiceRequest,
} from "./services.types.js";

type ServiceRow = {
  id: string;
  tenantId: string;
  businessLine: ServiceBusinessLine;
  name: string;
  category: string | null;
  description: string | null;
  pricingMode: "per_item" | "per_kg";
  status: "active" | "disabled";
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

function toServiceSummary(row: ServiceRow): ServiceSummary {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAuditSnapshot(row: ServiceSummary): ServiceAuditSnapshot {
  return {
    tenantId: row.tenantId,
    businessLine: row.businessLine,
    name: row.name,
    category: row.category,
    description: row.description,
    pricingMode: row.pricingMode,
    status: row.status,
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

export async function findServices(
  db: Database,
  input: ServiceListInput & { tenantId: string },
): Promise<ServiceSummary[]> {
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

  if (input.q) {
    filters.push(sql`(name ilike ${`%${input.q}%`} or category ilike ${`%${input.q}%`})`);
  }

  const result = (await db.execute(sql`
    select
      id,
      tenant_id as "tenantId",
      business_line as "businessLine",
      name,
      category,
      description,
      pricing_mode as "pricingMode",
      status,
      sort_order as "sortOrder",
      created_at as "createdAt",
      updated_at as "updatedAt",
      version
    from services
    where ${sql.join(filters, sql` and `)}
    order by sort_order asc, name asc
    limit ${input.limit}
    offset ${input.offset}
  `)) as unknown as QueryResult<ServiceRow>;

  return result.rows.map(toServiceSummary);
}

export async function findServiceById(
  db: Database,
  input: { tenantId: string; serviceId: string },
): Promise<ServiceSummary | null> {
  const result = (await db.execute(sql`
    select
      id,
      tenant_id as "tenantId",
      business_line as "businessLine",
      name,
      category,
      description,
      pricing_mode as "pricingMode",
      status,
      sort_order as "sortOrder",
      created_at as "createdAt",
      updated_at as "updatedAt",
      version
    from services
    where id = ${input.serviceId}
      and tenant_id = ${input.tenantId}
      and deleted_at is null
    limit 1
  `)) as unknown as QueryResult<ServiceRow>;

  const row = result.rows[0];

  return row ? toServiceSummary(row) : null;
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
  const result = (await db.execute(sql`
    select id
    from services
    where tenant_id = ${input.tenantId}
      and lower(name) = lower(${input.name})
      and deleted_at is null
      and (${input.excludeServiceId ?? null}::varchar is null or id <> ${input.excludeServiceId ?? null})
    limit 1
  `)) as unknown as QueryResult<{ id: string }>;

  return result.rows[0] ?? null;
}

export async function createServiceRecord(
  db: Database,
  input: CreateServiceRequest & { tenantId: string; actorUserId: string },
): Promise<ServiceSummary> {
  const serviceId = createId();
  const now = new Date();

  await db.execute(sql`
    insert into services (
      id,
      tenant_id,
      business_line,
      name,
      category,
      description,
      pricing_mode,
      status,
      sort_order,
      created_at,
      updated_at,
      created_by,
      updated_by,
      version
    )
    values (
      ${serviceId},
      ${input.tenantId},
      ${input.businessLine},
      ${input.name.trim()},
      ${normalizeNullable(input.category)},
      ${normalizeNullable(input.description)},
      ${input.pricingMode},
      ${input.status ?? "active"},
      ${input.sortOrder ?? 0},
      ${now},
      ${now},
      ${input.actorUserId},
      ${input.actorUserId},
      1
    )
  `);

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

  const next = {
    businessLine: input.businessLine ?? existing.businessLine,
    name: input.name?.trim() ?? existing.name,
    category:
      typeof input.category === "undefined"
        ? existing.category
        : normalizeNullable(input.category),
    description:
      typeof input.description === "undefined"
        ? existing.description
        : normalizeNullable(input.description),
    pricingMode: input.pricingMode ?? existing.pricingMode,
    status: input.status ?? existing.status,
    sortOrder: input.sortOrder ?? existing.sortOrder,
  };
  const now = new Date();

  await db.execute(sql`
    update services
    set
      business_line = ${next.businessLine},
      name = ${next.name},
      category = ${next.category},
      description = ${next.description},
      pricing_mode = ${next.pricingMode},
      status = ${next.status},
      sort_order = ${next.sortOrder},
      updated_at = ${now},
      updated_by = ${input.actorUserId},
      version = version + 1
    where id = ${input.serviceId}
      and tenant_id = ${input.tenantId}
      and deleted_at is null
  `);

  return findServiceById(db, input);
}

export async function updateServiceStatusRecord(
  db: Database,
  input: {
    tenantId: string;
    serviceId: string;
    status: ServiceStatus;
    actorUserId: string;
  },
): Promise<ServiceSummary | null> {
  const now = new Date();

  await db.execute(sql`
    update services
    set
      status = ${input.status},
      updated_at = ${now},
      updated_by = ${input.actorUserId},
      version = version + 1
    where id = ${input.serviceId}
      and tenant_id = ${input.tenantId}
      and deleted_at is null
  `);

  return findServiceById(db, input);
}

export async function softDeleteServiceRecord(
  db: Database,
  input: { tenantId: string; serviceId: string; actorUserId: string },
): Promise<boolean> {
  const now = new Date();
  const result = (await db.execute(sql`
    update services
    set
      deleted_at = ${now},
      deleted_by = ${input.actorUserId},
      updated_at = ${now},
      updated_by = ${input.actorUserId},
      version = version + 1
    where id = ${input.serviceId}
      and tenant_id = ${input.tenantId}
      and deleted_at is null
    returning id
  `)) as unknown as QueryResult<{ id: string }>;

  return Boolean(result.rows[0]);
}
