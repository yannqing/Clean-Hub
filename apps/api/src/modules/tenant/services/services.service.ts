import { getDb, type Database } from "@cleanhub/db";

import {
  assertActiveTenant,
  assertTenantContext,
  requireFeatureEnabled,
} from "../../auth/permission.helper.js";
import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import {
  MediaError,
  MediaService,
  type MediaUploadTicket,
} from "../../media/index.js";
import { findBranchById } from "../branches/branches.repository.js";
import { findServiceCategoryById } from "../service-categories/service-categories.repository.js";
import { TenantServicesError } from "./services.errors.js";
import {
  createServiceRecord,
  findServiceAuditSnapshotById,
  findServiceByCode,
  findServiceDetailById,
  findServiceMediaRecordsByItems,
  findServiceByName,
  findServicePriceAuditSnapshotByServiceId,
  findServices,
  softDeleteServiceRecord,
  updateServiceRecord,
  updateServiceStatusRecord,
} from "./services.repository.js";
import type {
  CreateServiceRequest,
  RequestTenantServiceMediaDownloads,
  RequestTenantServiceMediaUpload,
  ServiceApplicableItemType,
  ServiceBusinessLine,
  ServiceBranchSettingInput,
  ServiceDetail,
  ServiceDetailRecord,
  ServiceListInput,
  ServiceStatus,
  ServiceSummary,
  ServicePriceAuditSnapshot,
  TenantServiceMediaDownloadListResponse,
  TenantServiceMediaUploadTicket,
  UpdateServiceRequest,
} from "./services.types.js";

const SERVICE_IMAGE_PURPOSE = "service_image";

function requireApplicableItemTypesMatchBusinessLine(
  businessLine: ServiceBusinessLine,
  itemTypes: ServiceApplicableItemType[],
): void {
  const invalid =
    businessLine === "car_wash"
      ? itemTypes.some((itemType) => itemType !== "car")
      : businessLine === "laundry"
        ? itemTypes.includes("car")
        : false;

  if (invalid) {
    throw new TenantServicesError(
      "SERVICE_APPLICABLE_ITEM_TYPES_INVALID",
      businessLine === "car_wash"
        ? "Car-wash services can only apply to vehicles."
        : "Laundry services cannot apply to vehicles.",
      422,
    );
  }
}

type TenantServiceMediaServiceLike = Pick<
  MediaService,
  "requestUpload" | "assertOwnedPendingAndUploaded"
>;

type TenantServiceMediaDownloadServiceLike = Pick<
  MediaService,
  "createDownloadLinkForKnownCommittedObject"
>;

function mapServiceMediaError(error: MediaError): TenantServicesError {
  if (error.code === "MEDIA_FORBIDDEN") {
    return new TenantServicesError(
      "SERVICE_MEDIA_FORBIDDEN",
      "Service image is not accessible.",
      403,
    );
  }
  if (error.code === "MEDIA_NOT_FOUND") {
    return new TenantServicesError(
      "SERVICE_MEDIA_NOT_FOUND",
      error.message,
      404,
    );
  }
  if (error.code === "MEDIA_CONFLICT") {
    return new TenantServicesError(
      "SERVICE_MEDIA_CONFLICT",
      "Service image has already been used.",
      409,
    );
  }
  if (error.code === "MEDIA_STORAGE_ERROR") {
    return new TenantServicesError(
      "SERVICE_MEDIA_STORAGE_ERROR",
      "Service image storage is unavailable.",
      500,
    );
  }
  return new TenantServicesError("SERVICE_MEDIA_INVALID", error.message, 422);
}

async function assertPendingServiceImages(
  mediaService: TenantServiceMediaServiceLike,
  input: {
    tenantId: string;
    actorUserId: string;
    objectKeys: string[];
  },
): Promise<void> {
  try {
    await Promise.all(
      input.objectKeys.map((objectKey) =>
        mediaService.assertOwnedPendingAndUploaded({
          tenantId: input.tenantId,
          objectKey,
          expectedPurpose: SERVICE_IMAGE_PURPOSE,
          expectedCreatedBy: input.actorUserId,
        }),
      ),
    );
  } catch (error) {
    if (error instanceof MediaError) {
      throw mapServiceMediaError(error);
    }
    throw error;
  }
}

async function addServiceMediaDownloadLinks(
  tenantId: string,
  record: ServiceDetailRecord,
  mediaService: TenantServiceMediaDownloadServiceLike,
): Promise<ServiceDetail> {
  try {
    const media = await Promise.all(
      record.media.map(async (item) => {
        const ticket =
          await mediaService.createDownloadLinkForKnownCommittedObject({
            tenantId,
            objectKey: item.objectKey,
          });
        return {
          ...item,
          downloadUrl: ticket.downloadUrl,
          expiresAt: ticket.expiresAt,
        };
      }),
    );
    return { ...record, media };
  } catch (error) {
    if (error instanceof MediaError) {
      throw mapServiceMediaError(error);
    }
    throw error;
  }
}

function requireTenantContext(authContext: AuthContext): string {
  assertTenantContext(authContext);

  return authContext.tenantId!;
}

async function requireTenantReadyForServices(
  authContext: AuthContext,
  db: Database,
  businessLine?: ServiceListInput["businessLine"],
): Promise<void> {
  await assertActiveTenant(authContext, db);

  if (businessLine) {
    await requireFeatureEnabled(authContext, businessLine, db);
  }
}

async function requireCompatibleServiceCategory(
  db: Database,
  input: {
    tenantId: string;
    categoryId: string;
    businessLine: ServiceBusinessLine;
    allowInactive: boolean;
  },
): Promise<void> {
  const category = await findServiceCategoryById(db, {
    tenantId: input.tenantId,
    categoryId: input.categoryId,
  });

  if (!category) {
    throw new TenantServicesError(
      "SERVICE_CATEGORY_NOT_FOUND",
      "Service category was not found.",
      404,
    );
  }

  if (category.businessLine !== input.businessLine) {
    throw new TenantServicesError(
      "SERVICE_CATEGORY_BUSINESS_LINE_MISMATCH",
      "Service category does not belong to the selected business line.",
      422,
    );
  }

  if (!input.allowInactive && category.status !== "active") {
    throw new TenantServicesError(
      "SERVICE_CATEGORY_INACTIVE",
      "Inactive service categories cannot be assigned.",
      422,
    );
  }
}

async function requireValidServiceBranchSettings(
  db: Database,
  input: {
    tenantId: string;
    allBranches: boolean;
    branchSettings: ServiceBranchSettingInput[];
    allowInactiveBranchIds?: Set<string>;
  },
): Promise<void> {
  if (
    !input.allBranches &&
    input.branchSettings.every((setting) => !setting.isAvailable)
  ) {
    throw new TenantServicesError(
      "SERVICE_BRANCH_REQUIRED",
      "Select at least one branch that provides this service.",
      422,
    );
  }

  const branchIds = new Set<string>();
  for (const setting of input.branchSettings) {
    if (branchIds.has(setting.branchId)) {
      throw new TenantServicesError(
        "SERVICE_BRANCH_NOT_FOUND",
        "A branch can only be configured once.",
        422,
      );
    }
    branchIds.add(setting.branchId);

    const branch = await findBranchById(db, {
      tenantId: input.tenantId,
      branchId: setting.branchId,
    });
    if (!branch) {
      throw new TenantServicesError(
        "SERVICE_BRANCH_NOT_FOUND",
        "One or more selected branches were not found.",
        422,
      );
    }
    if (
      branch.status !== "active" &&
      !input.allowInactiveBranchIds?.has(branch.id)
    ) {
      throw new TenantServicesError(
        "SERVICE_BRANCH_INACTIVE",
        "Inactive branches cannot be newly assigned to a service.",
        422,
      );
    }
  }
}

function didPriceChange(
  before: ServicePriceAuditSnapshot,
  after: ServicePriceAuditSnapshot,
): boolean {
  return (
    before.amount !== after.amount ||
    before.compareAtAmount !== after.compareAtAmount ||
    before.costAmount !== after.costAmount ||
    before.currency !== after.currency ||
    before.status !== after.status
  );
}

async function writeServicePriceUpdatedAuditLog(
  db: Database,
  input: {
    authContext: AuthContext;
    requestMeta: AuthRequestMeta;
    before: ServicePriceAuditSnapshot;
    after: ServicePriceAuditSnapshot;
  },
): Promise<void> {
  if (!didPriceChange(input.before, input.after)) {
    return;
  }

  const toAuditPayload = (snapshot: ServicePriceAuditSnapshot) => ({
    tenantId: snapshot.tenantId,
    serviceId: snapshot.serviceId,
    serviceName: snapshot.serviceName,
    businessLine: snapshot.businessLine,
    amount: snapshot.amount,
    compareAtAmount: snapshot.compareAtAmount,
    costAmount: snapshot.costAmount,
    currency: snapshot.currency,
    status: snapshot.status,
  });

  await writeAuditLog(db, {
    actorUserId: input.authContext.userId,
    tenantId: input.authContext.tenantId,
    eventCategory: "tenant_price",
    eventType: "price.updated",
    entityType: "price",
    entityId: input.after.id,
    before: toAuditPayload(input.before),
    after: toAuditPayload(input.after),
    ipAddress: input.requestMeta.ipAddress,
    userAgent: input.requestMeta.userAgent,
  });
}

export async function listTenantServices(
  authContext: AuthContext,
  input: ServiceListInput,
  db: Database = getDb(),
): Promise<ServiceSummary[]> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForServices(authContext, db, input.businessLine);

  return findServices(db, {
    ...input,
    tenantId,
  });
}

export async function getTenantServiceDetail(
  authContext: AuthContext,
  serviceId: string,
  db: Database = getDb(),
  mediaService: TenantServiceMediaDownloadServiceLike = new MediaService(),
): Promise<ServiceDetail> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForServices(authContext, db);

  const service = await findServiceDetailById(db, {
    tenantId,
    serviceId,
  });

  if (!service) {
    throw new TenantServicesError(
      "SERVICE_NOT_FOUND",
      "Service was not found.",
      404,
    );
  }

  await requireTenantReadyForServices(authContext, db, service.businessLine);

  return addServiceMediaDownloadLinks(tenantId, service, mediaService);
}

export async function requestTenantServiceMediaDownloads(
  authContext: AuthContext,
  data: RequestTenantServiceMediaDownloads,
  db: Database = getDb(),
  mediaService: TenantServiceMediaDownloadServiceLike = new MediaService(),
): Promise<TenantServiceMediaDownloadListResponse> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForServices(authContext, db);

  const mediaRecords = await findServiceMediaRecordsByItems(db, {
    tenantId,
    items: data.items,
  });

  try {
    const downloads = await Promise.all(
      mediaRecords.map(async (media) => {
        const ticket =
          await mediaService.createDownloadLinkForKnownCommittedObject({
            tenantId,
            objectKey: media.objectKey,
          });

        return {
          serviceId: media.serviceId,
          mediaId: media.mediaId,
          downloadUrl: ticket.downloadUrl,
          expiresAt: ticket.expiresAt,
        };
      }),
    );

    return { data: downloads };
  } catch (error) {
    if (error instanceof MediaError) {
      throw mapServiceMediaError(error);
    }

    throw error;
  }
}

export async function createTenantService(
  authContext: AuthContext,
  data: CreateServiceRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
  mediaService: TenantServiceMediaServiceLike &
    TenantServiceMediaDownloadServiceLike = new MediaService(),
): Promise<ServiceDetail> {
  const tenantId = requireTenantContext(authContext);

  requireApplicableItemTypesMatchBusinessLine(
    data.businessLine,
    data.applicableItemTypes,
  );

  await requireTenantReadyForServices(authContext, db, data.businessLine);
  await requireCompatibleServiceCategory(db, {
    tenantId,
    categoryId: data.categoryId,
    businessLine: data.businessLine,
    allowInactive: false,
  });

  const duplicate = await findServiceByName(db, {
    tenantId,
    name: data.name,
  });

  if (duplicate) {
    throw new TenantServicesError(
      "SERVICE_NAME_DUPLICATE",
      "Service name already exists in this tenant.",
      409,
    );
  }

  if (data.code) {
    const duplicateCode = await findServiceByCode(db, {
      tenantId,
      code: data.code,
    });

    if (duplicateCode) {
      throw new TenantServicesError(
        "SERVICE_CODE_DUPLICATE",
        "Service code already exists in this tenant.",
        409,
      );
    }
  }

  if (
    data.compareAtPrice != null &&
    Number(data.compareAtPrice) <= Number(data.standardPrice)
  ) {
    throw new TenantServicesError(
      "SERVICE_COMPARE_AT_PRICE_INVALID",
      "Compare-at price must be greater than the standard price.",
      422,
    );
  }

  await requireValidServiceBranchSettings(db, {
    tenantId,
    allBranches: data.allBranches ?? true,
    branchSettings: data.branchSettings ?? [],
  });

  await assertPendingServiceImages(mediaService, {
    tenantId,
    actorUserId: authContext.userId,
    objectKeys: data.mediaObjectKeys ?? [],
  });

  const service = await db.transaction(async (tx) => {
    const service = await createServiceRecord(tx, {
      ...data,
      tenantId,
      actorUserId: authContext.userId,
    });

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      eventCategory: "tenant_service",
      eventType: "service.created",
      entityType: "service",
      entityId: service.id,
      after: service,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return service;
  });

  return addServiceMediaDownloadLinks(tenantId, service, mediaService);
}

export async function updateTenantService(
  authContext: AuthContext,
  serviceId: string,
  data: UpdateServiceRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
  mediaService: TenantServiceMediaServiceLike &
    TenantServiceMediaDownloadServiceLike = new MediaService(),
): Promise<ServiceDetail> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForServices(authContext, db);

  if (data.name) {
    const duplicate = await findServiceByName(db, {
      tenantId,
      name: data.name,
      excludeServiceId: serviceId,
    });

    if (duplicate) {
      throw new TenantServicesError(
        "SERVICE_NAME_DUPLICATE",
        "Service name already exists in this tenant.",
        409,
      );
    }
  }

  if (data.code) {
    const duplicateCode = await findServiceByCode(db, {
      tenantId,
      code: data.code,
      excludeServiceId: serviceId,
    });

    if (duplicateCode) {
      throw new TenantServicesError(
        "SERVICE_CODE_DUPLICATE",
        "Service code already exists in this tenant.",
        409,
      );
    }
  }

  await assertPendingServiceImages(mediaService, {
    tenantId,
    actorUserId: authContext.userId,
    objectKeys: data.newMediaObjectKeys ?? [],
  });

  const service = await db.transaction(async (tx) => {
    const [before, beforePrice] = await Promise.all([
      findServiceAuditSnapshotById(tx, {
        tenantId,
        serviceId,
      }),
      findServicePriceAuditSnapshotByServiceId(tx, {
        tenantId,
        serviceId,
      }),
    ]);

    if (!before || !beforePrice) {
      throw new TenantServicesError(
        "SERVICE_NOT_FOUND",
        "Service was not found.",
        404,
      );
    }

    const nextAllBranches = data.allBranches ?? before.allBranches;
    requireApplicableItemTypesMatchBusinessLine(
      data.businessLine ?? before.businessLine,
      data.applicableItemTypes ?? before.applicableItemTypes,
    );
    const nextBranchSettings = data.branchSettings ?? before.branchSettings;
    await requireValidServiceBranchSettings(tx, {
      tenantId,
      allBranches: nextAllBranches,
      branchSettings: nextBranchSettings,
      allowInactiveBranchIds: new Set(
        before.branchSettings.map((setting) => setting.branchId),
      ),
    });

    const nextStandardPrice = data.standardPrice ?? beforePrice.amount;
    const nextCompareAtPrice =
      data.compareAtPrice === undefined
        ? beforePrice.compareAtAmount
        : data.compareAtPrice;

    if (
      nextCompareAtPrice != null &&
      Number(nextCompareAtPrice) <= Number(nextStandardPrice)
    ) {
      throw new TenantServicesError(
        "SERVICE_COMPARE_AT_PRICE_INVALID",
        "Compare-at price must be greater than the standard price.",
        422,
      );
    }

    await requireTenantReadyForServices(
      authContext,
      tx,
      data.businessLine ?? before.businessLine,
    );
    const categoryId = data.categoryId ?? before.categoryId;
    await requireCompatibleServiceCategory(tx, {
      tenantId,
      categoryId,
      businessLine: data.businessLine ?? before.businessLine,
      allowInactive: categoryId === before.categoryId,
    });

    const service = await updateServiceRecord(tx, {
      ...data,
      tenantId,
      serviceId,
      actorUserId: authContext.userId,
    });

    if (!service) {
      throw new TenantServicesError(
        "SERVICE_NOT_FOUND",
        "Service was not found.",
        404,
      );
    }

    const afterPrice = await findServicePriceAuditSnapshotByServiceId(tx, {
      tenantId,
      serviceId,
    });

    if (!afterPrice) {
      throw new TenantServicesError(
        "SERVICE_NOT_FOUND",
        "The service price was not found.",
        404,
      );
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      eventCategory: "tenant_service",
      eventType: "service.updated",
      entityType: "service",
      entityId: serviceId,
      before,
      after: service,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    await writeServicePriceUpdatedAuditLog(tx, {
      authContext,
      requestMeta,
      before: beforePrice,
      after: afterPrice,
    });

    return service;
  });

  return addServiceMediaDownloadLinks(tenantId, service, mediaService);
}

export async function requestTenantServiceMediaUpload(
  authContext: AuthContext,
  data: RequestTenantServiceMediaUpload,
  db: Database = getDb(),
  mediaService: TenantServiceMediaServiceLike = new MediaService(),
): Promise<TenantServiceMediaUploadTicket> {
  const tenantId = requireTenantContext(authContext);
  await requireTenantReadyForServices(authContext, db);

  try {
    const ticket: MediaUploadTicket = await mediaService.requestUpload({
      tenantId,
      actorUserId: authContext.userId,
      purpose: SERVICE_IMAGE_PURPOSE,
      contentType: data.contentType,
      sizeBytes: data.sizeBytes,
    });
    return ticket;
  } catch (error) {
    if (error instanceof MediaError) {
      throw mapServiceMediaError(error);
    }
    throw error;
  }
}

export async function updateTenantServiceStatus(
  authContext: AuthContext,
  serviceId: string,
  status: ServiceStatus,
  version: number,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<ServiceSummary> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForServices(authContext, db);

  return db.transaction(async (tx) => {
    const [before, beforePrice] = await Promise.all([
      findServiceAuditSnapshotById(tx, {
        tenantId,
        serviceId,
      }),
      findServicePriceAuditSnapshotByServiceId(tx, {
        tenantId,
        serviceId,
      }),
    ]);

    if (!before || !beforePrice) {
      throw new TenantServicesError(
        "SERVICE_NOT_FOUND",
        "Service was not found.",
        404,
      );
    }

    await requireTenantReadyForServices(authContext, tx, before.businessLine);

    const service = await updateServiceStatusRecord(tx, {
      tenantId,
      serviceId,
      status,
      version,
      actorUserId: authContext.userId,
    });

    if (!service) {
      throw new TenantServicesError(
        "SERVICE_NOT_FOUND",
        "Service was not found.",
        404,
      );
    }

    const afterPrice = await findServicePriceAuditSnapshotByServiceId(tx, {
      tenantId,
      serviceId,
    });

    if (!afterPrice) {
      throw new TenantServicesError(
        "SERVICE_NOT_FOUND",
        "The service price was not found.",
        404,
      );
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      eventCategory: "tenant_service",
      eventType: "service.status_changed",
      entityType: "service",
      entityId: serviceId,
      before: {
        status: before.status,
      },
      after: {
        status: service.status,
      },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    await writeServicePriceUpdatedAuditLog(tx, {
      authContext,
      requestMeta,
      before: beforePrice,
      after: afterPrice,
    });

    return service;
  });
}

export async function deleteTenantService(
  authContext: AuthContext,
  serviceId: string,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<void> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForServices(authContext, db);

  await db.transaction(async (tx) => {
    const before = await findServiceAuditSnapshotById(tx, {
      tenantId,
      serviceId,
    });

    if (!before) {
      throw new TenantServicesError(
        "SERVICE_NOT_FOUND",
        "Service was not found.",
        404,
      );
    }

    await requireTenantReadyForServices(authContext, tx, before.businessLine);

    const deleted = await softDeleteServiceRecord(tx, {
      tenantId,
      serviceId,
      actorUserId: authContext.userId,
    });

    if (!deleted) {
      throw new TenantServicesError(
        "SERVICE_NOT_FOUND",
        "Service was not found.",
        404,
      );
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      eventCategory: "tenant_service",
      eventType: "service.deleted",
      entityType: "service",
      entityId: serviceId,
      before,
      after: {
        deleted: true,
      },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
  });
}
