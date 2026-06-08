import { getDb, type Database } from "@cleanhub/db";

import {
  assertActiveTenant,
  assertTenantContext,
  requireFeatureEnabled,
} from "../auth/permission.helper.js";
import type { AuthContext, AuthRequestMeta } from "../auth/auth.types.js";
import { writeAuditLog } from "../audit/audit.helper.js";
import { TenantServicesError } from "./services.errors.js";
import {
  createServiceRecord,
  findServiceAuditSnapshotById,
  findServiceById,
  findServiceByName,
  findServices,
  softDeleteServiceRecord,
  updateServiceRecord,
  updateServiceStatusRecord,
} from "./services.repository.js";
import type {
  CreateServiceRequest,
  ServiceListInput,
  ServiceStatus,
  ServiceSummary,
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
      authContext,
      tx,
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

  await requireTenantReadyForServices(authContext, db);

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

    await requireTenantReadyForServices(authContext, tx, before.businessLine);

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
