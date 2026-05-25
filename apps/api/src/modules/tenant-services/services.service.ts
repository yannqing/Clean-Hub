import { getDb, type Database } from "@cleanhub/db";

import { AuthError } from "../auth/auth.errors.js";
import type { AuthContext, AuthRequestMeta } from "../auth/auth.types.js";
import { writeAuditLog } from "../audit/audit.helper.js";
import { TenantServicesError } from "./services.errors.js";
import {
  createServiceRecord,
  findServiceAuditSnapshotById,
  findServiceById,
  findServiceByName,
  findServices,
  findTenantAccessById,
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
  UpdateServiceRequest,
} from "./services.types.js";

function requireTenantContext(authContext: AuthContext): string {
  if (!authContext.tenantId) {
    throw new TenantServicesError(
      "TENANT_CONTEXT_REQUIRED",
      "Tenant context is required for service catalog APIs.",
      403,
    );
  }

  if (authContext.role !== "owner" && authContext.role !== "manager") {
    throw new AuthError("FORBIDDEN", "User cannot access tenant services.");
  }

  return authContext.tenantId;
}

function isBusinessLineEnabled(
  businessLine: ServiceBusinessLine,
  flags: {
    laundryEnabled: boolean | null;
    carWashEnabled: boolean | null;
    retailProductsEnabled: boolean | null;
  },
): boolean {
  if (
    businessLine === "laundry" ||
    businessLine === "dry_cleaning" ||
    businessLine === "pressing"
  ) {
    return flags.laundryEnabled ?? true;
  }

  if (businessLine === "car_wash") {
    return flags.carWashEnabled ?? false;
  }

  return flags.retailProductsEnabled ?? false;
}

async function requireTenantReadyForServices(
  db: Database,
  tenantId: string,
  businessLine?: ServiceBusinessLine,
): Promise<void> {
  const tenant = await findTenantAccessById(db, tenantId);

  if (!tenant || tenant.status !== "active") {
    throw new TenantServicesError(
      "TENANT_NOT_ACTIVE",
      "Tenant is not active.",
      403,
    );
  }

  if (businessLine && !isBusinessLineEnabled(businessLine, tenant)) {
    throw new TenantServicesError(
      "FEATURE_DISABLED",
      "This business line is not enabled for the tenant.",
      403,
    );
  }
}

export async function listTenantServices(
  authContext: AuthContext,
  input: ServiceListInput,
  db: Database = getDb(),
): Promise<ServiceSummary[]> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForServices(db, tenantId, input.businessLine);

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

  await requireTenantReadyForServices(db, tenantId);

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

  await requireTenantReadyForServices(db, tenantId, service.businessLine);

  return service;
}

export async function createTenantService(
  authContext: AuthContext,
  data: CreateServiceRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<ServiceSummary> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForServices(db, tenantId, data.businessLine);

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

  await requireTenantReadyForServices(db, tenantId);

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

    await requireTenantReadyForServices(
      tx,
      tenantId,
      data.businessLine ?? before.businessLine,
    );

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

    return service;
  });
}

export async function updateTenantServiceStatus(
  authContext: AuthContext,
  serviceId: string,
  status: ServiceStatus,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<ServiceSummary> {
  const tenantId = requireTenantContext(authContext);

  await requireTenantReadyForServices(db, tenantId);

  return db.transaction(async (tx) => {
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

    await requireTenantReadyForServices(tx, tenantId, before.businessLine);

    const service = await updateServiceStatusRecord(tx, {
      tenantId,
      serviceId,
      status,
      actorUserId: authContext.userId,
    });

    if (!service) {
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

  await requireTenantReadyForServices(db, tenantId);

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

    await requireTenantReadyForServices(tx, tenantId, before.businessLine);

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
