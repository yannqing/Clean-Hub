import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  branches,
  mediaObjects,
  prices,
  serviceBranchSettings,
  serviceCategories,
  serviceMedia,
  services,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import { findTenantDefaultCurrency } from "../settings/settings.repository.js";

import type {
  CreateServiceRequest,
  ServiceAuditSnapshot,
  ServiceBranchSetting,
  ServiceDetailRecord,
  ServiceListInput,
  ServicePriceAuditSnapshot,
  ServiceMediaRecord,
  ServiceStatus,
  ServiceSummary,
  UpdateServiceRequest,
} from "./services.types.js";
import { TenantServicesError } from "./services.errors.js";

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function normalizeCode(value: string | null | undefined): string | null {
  return normalizeNullable(value)?.toUpperCase() ?? null;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

type ServiceJoinedRow = {
  id: string;
  tenantId: string;
  businessLine: ServiceSummary["businessLine"];
  name: string;
  code: string | null;
  shortName: string | null;
  categoryId: string | null;
  categoryName: string;
  description: string | null;
  internalNotes: string | null;
  turnaroundMinutes: number | null;
  allBranches: boolean;
  availableBranchCount: string | number | null;
  displayOrder: number;
  pricingUnit: ServiceSummary["pricingUnit"];
  labelRule: ServiceSummary["labelRule"];
  standardPrice: string;
  compareAtPrice: string | null;
  costPrice: string | null;
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
    code: services.code,
    shortName: services.shortName,
    categoryId: services.categoryId,
    categoryName: serviceCategories.name,
    description: services.description,
    internalNotes: services.internalNotes,
    turnaroundMinutes: services.turnaroundMinutes,
    allBranches: services.allBranches,
    availableBranchCount: sql<number>`(
      case when ${services.allBranches} then (
        select count(*)::int from ${branches}
        where ${branches.tenantId} = ${services.tenantId}
          and ${branches.status} = 'active'
          and ${branches.deletedAt} is null
      ) else (
        select count(*)::int from ${serviceBranchSettings}
        inner join ${branches} on ${branches.id} = ${serviceBranchSettings.branchId}
          and ${branches.tenantId} = ${serviceBranchSettings.tenantId}
        where ${serviceBranchSettings.tenantId} = ${services.tenantId}
          and ${serviceBranchSettings.serviceId} = ${services.id}
          and ${serviceBranchSettings.isAvailable} = true
          and ${branches.status} = 'active'
          and ${branches.deletedAt} is null
      ) end
    )`,
    displayOrder: services.displayOrder,
    pricingUnit: services.pricingUnit,
    labelRule: services.labelRule,
    standardPrice: prices.amount,
    compareAtPrice: prices.compareAtAmount,
    costPrice: prices.costAmount,
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
    code: row.code,
    shortName: row.shortName,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    description: row.description,
    internalNotes: row.internalNotes,
    turnaroundMinutes: row.turnaroundMinutes,
    allBranches: row.allBranches,
    availableBranchCount: Number(row.availableBranchCount ?? 0),
    displayOrder: row.displayOrder,
    pricingUnit: row.pricingUnit,
    labelRule: row.labelRule,
    standardPrice: row.standardPrice,
    compareAtPrice: row.compareAtPrice,
    costPrice: row.costPrice,
    currency: row.currency,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

function toAuditSnapshot(row: ServiceDetailRecord): ServiceAuditSnapshot {
  return {
    tenantId: row.tenantId,
    businessLine: row.businessLine,
    name: row.name,
    code: row.code,
    shortName: row.shortName,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    description: row.description,
    internalNotes: row.internalNotes,
    turnaroundMinutes: row.turnaroundMinutes,
    allBranches: row.allBranches,
    branchSettings: row.branchSettings,
    media: row.media,
    displayOrder: row.displayOrder,
    pricingUnit: row.pricingUnit,
    labelRule: row.labelRule,
    standardPrice: row.standardPrice,
    compareAtPrice: row.compareAtPrice,
    costPrice: row.costPrice,
    currency: row.currency,
    status: row.status,
  };
}

export async function findServiceMediaRecords(
  db: Database,
  input: { tenantId: string; serviceId: string },
): Promise<ServiceMediaRecord[]> {
  return db
    .select({
      id: serviceMedia.id,
      objectKey: mediaObjects.objectKey,
      isPrimary: serviceMedia.isPrimary,
      sortOrder: serviceMedia.sortOrder,
    })
    .from(serviceMedia)
    .innerJoin(
      mediaObjects,
      and(
        eq(mediaObjects.tenantId, serviceMedia.tenantId),
        eq(mediaObjects.id, serviceMedia.mediaObjectId),
        eq(mediaObjects.status, "committed"),
        isNull(mediaObjects.deletedAt),
      ),
    )
    .where(
      and(
        eq(serviceMedia.tenantId, input.tenantId),
        eq(serviceMedia.serviceId, input.serviceId),
        isNull(serviceMedia.deletedAt),
      ),
    )
    .orderBy(
      desc(serviceMedia.isPrimary),
      asc(serviceMedia.sortOrder),
      asc(serviceMedia.id),
    );
}

export async function findServiceBranchSettings(
  db: Database,
  input: { tenantId: string; serviceId: string },
): Promise<ServiceBranchSetting[]> {
  return db
    .select({
      branchId: serviceBranchSettings.branchId,
      branchName: branches.name,
      branchStatus: branches.status,
      isAvailable: serviceBranchSettings.isAvailable,
      priceOverrideAmount: serviceBranchSettings.priceOverrideAmount,
      turnaroundMinutesOverride:
        serviceBranchSettings.turnaroundMinutesOverride,
    })
    .from(serviceBranchSettings)
    .innerJoin(
      branches,
      and(
        eq(branches.id, serviceBranchSettings.branchId),
        eq(branches.tenantId, serviceBranchSettings.tenantId),
        isNull(branches.deletedAt),
      ),
    )
    .where(
      and(
        eq(serviceBranchSettings.tenantId, input.tenantId),
        eq(serviceBranchSettings.serviceId, input.serviceId),
      ),
    )
    .orderBy(asc(branches.name), asc(branches.id));
}

export async function findServiceDetailById(
  db: Database,
  input: { tenantId: string; serviceId: string },
): Promise<ServiceDetailRecord | null> {
  const service = await findServiceById(db, input);
  if (!service) {
    return null;
  }
  return {
    ...service,
    branchSettings: await findServiceBranchSettings(db, input),
    media: await findServiceMediaRecords(db, input),
  };
}

type LockedServiceMediaObject = {
  id: string;
  objectKey: string;
};

async function lockPendingServiceMediaObjects(
  db: Database,
  input: {
    tenantId: string;
    actorUserId: string;
    objectKeys: string[];
  },
): Promise<LockedServiceMediaObject[]> {
  if (input.objectKeys.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: mediaObjects.id,
      objectKey: mediaObjects.objectKey,
      status: mediaObjects.status,
      purpose: mediaObjects.purpose,
      createdBy: mediaObjects.createdBy,
      expiresAt: mediaObjects.expiresAt,
    })
    .from(mediaObjects)
    .where(
      and(
        eq(mediaObjects.tenantId, input.tenantId),
        inArray(mediaObjects.objectKey, input.objectKeys),
        isNull(mediaObjects.deletedAt),
      ),
    )
    .orderBy(asc(mediaObjects.objectKey))
    .for("update");
  const rowsByKey = new Map(rows.map((row) => [row.objectKey, row]));

  for (const objectKey of input.objectKeys) {
    const row = rowsByKey.get(objectKey);
    if (!row) {
      throw new TenantServicesError(
        "SERVICE_MEDIA_NOT_FOUND",
        "One or more service images were not found.",
        404,
      );
    }
    if (row.createdBy !== input.actorUserId) {
      throw new TenantServicesError(
        "SERVICE_MEDIA_FORBIDDEN",
        "One or more service images are not accessible.",
        403,
      );
    }
    if (row.purpose !== "service_image" || row.status !== "pending") {
      throw new TenantServicesError(
        "SERVICE_MEDIA_CONFLICT",
        "One or more service images are invalid or have already been used.",
        409,
      );
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new TenantServicesError(
        "SERVICE_MEDIA_INVALID",
        "One or more service image upload tickets have expired.",
        422,
      );
    }
  }

  const orderedRows = input.objectKeys.map(
    (objectKey) => rowsByKey.get(objectKey)!,
  );
  const boundRows = await db
    .select({ id: serviceMedia.id })
    .from(serviceMedia)
    .where(
      and(
        eq(serviceMedia.tenantId, input.tenantId),
        inArray(
          serviceMedia.mediaObjectId,
          orderedRows.map((row) => row.id),
        ),
        isNull(serviceMedia.deletedAt),
      ),
    )
    .limit(1);

  if (boundRows[0]) {
    throw new TenantServicesError(
      "SERVICE_MEDIA_CONFLICT",
      "One or more service images have already been used.",
      409,
    );
  }

  return orderedRows.map(({ id, objectKey }) => ({ id, objectKey }));
}

async function commitServiceMediaObjects(
  db: Database,
  input: {
    tenantId: string;
    serviceId: string;
    actorUserId: string;
    retainedMediaIds: string[];
    newMediaObjectKeys: string[];
  },
): Promise<void> {
  const existingMediaRows = await db
    .select({
      id: serviceMedia.id,
      mediaObjectId: serviceMedia.mediaObjectId,
    })
    .from(serviceMedia)
    .where(
      and(
        eq(serviceMedia.tenantId, input.tenantId),
        eq(serviceMedia.serviceId, input.serviceId),
        isNull(serviceMedia.deletedAt),
      ),
    )
    .orderBy(asc(serviceMedia.sortOrder), asc(serviceMedia.id))
    .for("update");
  const existingMediaById = new Map(
    existingMediaRows.map((media) => [media.id, media]),
  );

  if (
    input.retainedMediaIds.some((mediaId) => !existingMediaById.has(mediaId))
  ) {
    throw new TenantServicesError(
      "SERVICE_MEDIA_NOT_FOUND",
      "One or more retained service images were not found.",
      404,
    );
  }

  const lockedMediaObjects = await lockPendingServiceMediaObjects(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    objectKeys: input.newMediaObjectKeys,
  });
  const now = new Date();

  if (existingMediaRows.length > 0) {
    await db
      .update(serviceMedia)
      .set({ isPrimary: false })
      .where(
        and(
          eq(serviceMedia.tenantId, input.tenantId),
          eq(serviceMedia.serviceId, input.serviceId),
          isNull(serviceMedia.deletedAt),
        ),
      );
  }

  const retainedMediaIdSet = new Set(input.retainedMediaIds);
  const removedMediaRows = existingMediaRows.filter(
    (media) => !retainedMediaIdSet.has(media.id),
  );
  if (removedMediaRows.length > 0) {
    await db
      .update(serviceMedia)
      .set({ deletedAt: now, deletedBy: input.actorUserId })
      .where(
        and(
          eq(serviceMedia.tenantId, input.tenantId),
          inArray(
            serviceMedia.id,
            removedMediaRows.map((media) => media.id),
          ),
          isNull(serviceMedia.deletedAt),
        ),
      );
    await db
      .update(mediaObjects)
      .set({
        status: "deleting",
        cleanupClaimToken: createId(),
        cleanupClaimedAt: new Date(0),
      })
      .where(
        and(
          eq(mediaObjects.tenantId, input.tenantId),
          inArray(
            mediaObjects.id,
            removedMediaRows.map((media) => media.mediaObjectId),
          ),
          eq(mediaObjects.status, "committed"),
          isNull(mediaObjects.deletedAt),
        ),
      );
  }

  for (const [index, mediaId] of input.retainedMediaIds.entries()) {
    await db
      .update(serviceMedia)
      .set({ isPrimary: index === 0, sortOrder: index })
      .where(
        and(
          eq(serviceMedia.tenantId, input.tenantId),
          eq(serviceMedia.id, mediaId),
          isNull(serviceMedia.deletedAt),
        ),
      );
  }

  if (lockedMediaObjects.length === 0) {
    return;
  }

  await db.insert(serviceMedia).values(
    lockedMediaObjects.map((mediaObject, index) => {
      const sortOrder = input.retainedMediaIds.length + index;
      return {
        id: createId(),
        tenantId: input.tenantId,
        serviceId: input.serviceId,
        mediaObjectId: mediaObject.id,
        isPrimary: sortOrder === 0,
        sortOrder,
        createdAt: now,
        createdBy: input.actorUserId,
      };
    }),
  );
  const committedRows = await db
    .update(mediaObjects)
    .set({
      status: "committed",
      committedAt: now,
      cleanupClaimToken: null,
      cleanupClaimedAt: null,
    })
    .where(
      and(
        eq(mediaObjects.tenantId, input.tenantId),
        inArray(
          mediaObjects.id,
          lockedMediaObjects.map((mediaObject) => mediaObject.id),
        ),
        eq(mediaObjects.status, "pending"),
        isNull(mediaObjects.deletedAt),
      ),
    )
    .returning({ id: mediaObjects.id });

  if (committedRows.length !== lockedMediaObjects.length) {
    throw new TenantServicesError(
      "SERVICE_MEDIA_CONFLICT",
      "One or more service images have already been used.",
      409,
    );
  }
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
    filters.push(
      or(
        sql`${services.name} ilike ${query} escape '\\'`,
        sql`${services.code} ilike ${query} escape '\\'`,
        sql`${services.shortName} ilike ${query} escape '\\'`,
      )!,
    );
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
  const service = await findServiceDetailById(db, input);

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
      compareAtAmount: prices.compareAtAmount,
      costAmount: prices.costAmount,
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

export async function findServiceByCode(
  db: Database,
  input: { tenantId: string; code: string; excludeServiceId?: string },
): Promise<{ id: string } | null> {
  const filters: SQL[] = [
    eq(services.tenantId, input.tenantId),
    sql`upper(${services.code}) = upper(${input.code.trim()})`,
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

export async function replaceServiceBranchSettings(
  db: Database,
  input: {
    tenantId: string;
    serviceId: string;
    actorUserId: string;
    branchSettings: NonNullable<CreateServiceRequest["branchSettings"]>;
  },
): Promise<void> {
  await db
    .delete(serviceBranchSettings)
    .where(
      and(
        eq(serviceBranchSettings.tenantId, input.tenantId),
        eq(serviceBranchSettings.serviceId, input.serviceId),
      ),
    );

  if (input.branchSettings.length === 0) {
    return;
  }

  await db.insert(serviceBranchSettings).values(
    input.branchSettings.map((setting) => ({
      id: createId(),
      tenantId: input.tenantId,
      serviceId: input.serviceId,
      branchId: setting.branchId,
      isAvailable: setting.isAvailable,
      priceOverrideAmount: setting.priceOverrideAmount ?? null,
      turnaroundMinutesOverride: setting.turnaroundMinutesOverride ?? null,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })),
  );
}

export async function createServiceRecord(
  db: Database,
  input: CreateServiceRequest & { tenantId: string; actorUserId: string },
): Promise<ServiceDetailRecord> {
  const serviceId = createId();
  const currency = await findTenantDefaultCurrency(db, input.tenantId);

  await db.insert(services).values({
    id: serviceId,
    tenantId: input.tenantId,
    businessLine: input.businessLine,
    name: input.name.trim(),
    code: normalizeCode(input.code),
    shortName: normalizeNullable(input.shortName),
    categoryId: input.categoryId,
    description: normalizeNullable(input.description),
    internalNotes: normalizeNullable(input.internalNotes),
    turnaroundMinutes: input.turnaroundMinutes ?? null,
    allBranches: input.allBranches ?? true,
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
    compareAtAmount: input.compareAtPrice ?? null,
    costAmount: input.costPrice ?? null,
    currency,
    status: input.status ?? "active",
    createdBy: input.actorUserId,
    updatedBy: input.actorUserId,
  });

  await replaceServiceBranchSettings(db, {
    tenantId: input.tenantId,
    serviceId,
    actorUserId: input.actorUserId,
    branchSettings: input.branchSettings ?? [],
  });

  await commitServiceMediaObjects(db, {
    tenantId: input.tenantId,
    serviceId,
    actorUserId: input.actorUserId,
    retainedMediaIds: [],
    newMediaObjectKeys: input.mediaObjectKeys ?? [],
  });

  const service = await findServiceDetailById(db, {
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
): Promise<ServiceDetailRecord | null> {
  const existing = await findServiceById(db, input);

  if (!existing) {
    return null;
  }

  const updatedRows = await db
    .update(services)
    .set({
      businessLine: input.businessLine ?? existing.businessLine,
      name: input.name?.trim() ?? existing.name,
      code:
        input.code === undefined ? existing.code : normalizeCode(input.code),
      shortName:
        input.shortName === undefined
          ? existing.shortName
          : normalizeNullable(input.shortName),
      categoryId:
        input.categoryId === undefined ? existing.categoryId : input.categoryId,
      description:
        input.description === undefined
          ? existing.description
          : normalizeNullable(input.description),
      internalNotes:
        input.internalNotes === undefined
          ? existing.internalNotes
          : normalizeNullable(input.internalNotes),
      turnaroundMinutes:
        input.turnaroundMinutes === undefined
          ? existing.turnaroundMinutes
          : input.turnaroundMinutes,
      allBranches: input.allBranches ?? existing.allBranches,
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
    input.compareAtPrice !== undefined ||
    input.costPrice !== undefined ||
    input.status !== undefined
  ) {
    const updatedPriceRows = await db
      .update(prices)
      .set({
        amount: input.standardPrice ?? existing.standardPrice,
        compareAtAmount:
          input.compareAtPrice === undefined
            ? existing.compareAtPrice
            : input.compareAtPrice,
        costAmount:
          input.costPrice === undefined ? existing.costPrice : input.costPrice,
        currency: existing.currency,
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

  if (input.branchSettings !== undefined) {
    await replaceServiceBranchSettings(db, {
      tenantId: input.tenantId,
      serviceId: input.serviceId,
      actorUserId: input.actorUserId,
      branchSettings: input.branchSettings,
    });
  }

  if (
    input.retainedMediaIds !== undefined ||
    input.newMediaObjectKeys !== undefined
  ) {
    await commitServiceMediaObjects(db, {
      tenantId: input.tenantId,
      serviceId: input.serviceId,
      actorUserId: input.actorUserId,
      retainedMediaIds: input.retainedMediaIds ?? [],
      newMediaObjectKeys: input.newMediaObjectKeys ?? [],
    });
  }

  return findServiceDetailById(db, input);
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
  const now = new Date();
  const updatedRows = await db
    .update(services)
    .set({
      deletedAt: now,
      deletedBy: input.actorUserId,
      updatedAt: now,
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

  if (!updatedRows[0]) {
    return false;
  }

  const mediaRows = await db
    .select({
      id: serviceMedia.id,
      mediaObjectId: serviceMedia.mediaObjectId,
    })
    .from(serviceMedia)
    .where(
      and(
        eq(serviceMedia.tenantId, input.tenantId),
        eq(serviceMedia.serviceId, input.serviceId),
        isNull(serviceMedia.deletedAt),
      ),
    );

  if (mediaRows.length > 0) {
    await db
      .update(serviceMedia)
      .set({ deletedAt: now, deletedBy: input.actorUserId })
      .where(
        and(
          eq(serviceMedia.tenantId, input.tenantId),
          eq(serviceMedia.serviceId, input.serviceId),
          isNull(serviceMedia.deletedAt),
        ),
      );
    await db
      .update(mediaObjects)
      .set({
        status: "deleting",
        cleanupClaimToken: createId(),
        cleanupClaimedAt: new Date(0),
      })
      .where(
        and(
          eq(mediaObjects.tenantId, input.tenantId),
          inArray(
            mediaObjects.id,
            mediaRows.map((media) => media.mediaObjectId),
          ),
          eq(mediaObjects.status, "committed"),
          isNull(mediaObjects.deletedAt),
        ),
      );
  }

  return true;
}
