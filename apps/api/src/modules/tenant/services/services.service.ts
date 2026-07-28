import { getDb, type Database } from "@cleanhub/db";

import {
  assertActiveTenant,
  assertTenantContext,
  requireFeatureEnabled,
} from "../../auth/permission.helper.js";
import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { findServiceCategoryById } from "../service-categories/service-categories.repository.js";
import { TenantServicesError } from "./services.errors.js";
import {
  createServiceRecord,
  findServiceAuditSnapshotById,
  findServiceById,
  findServiceByName,
  findServicePriceAuditSnapshotByServiceId,
  findServices,
  softDeleteServiceRecord,
  updateServiceRecord,
  updateServiceStatusRecord,
} from "./services.repository.js";
import type {
  CreateServiceRequest,
  ServiceBusinessLine,
  ServiceListInput,
  ServiceStatus,
  ServiceSummary,
  ServicePriceAuditSnapshot,
  UpdateServiceRequest,
} from "./services.types.js";

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

function didPriceChange(
  before: ServicePriceAuditSnapshot,
  after: ServicePriceAuditSnapshot,
): boolean {
  return (
    before.amount !== after.amount ||
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
): Promise<ServiceSummary> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForServices(authContext, db);

  const service = await findServiceById(db, {
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

  return service;
}

export async function createTenantService(
  authContext: AuthContext,
  data: CreateServiceRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<ServiceSummary> {
  const tenantId = requireTenantContext(authContext);

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

  return db.transaction(async (tx) => {
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
}

export async function updateTenantService(
  authContext: AuthContext,
  serviceId: string,
  data: UpdateServiceRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<ServiceSummary> {
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
