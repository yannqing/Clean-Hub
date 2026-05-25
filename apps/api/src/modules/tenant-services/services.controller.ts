import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";
import { TenantServicesError } from "./services.errors.js";
import {
  createTenantService,
  deleteTenantService,
  getTenantServiceDetail,
  listTenantServices,
  updateTenantService,
  updateTenantServiceStatus,
} from "./services.service.js";
import {
  createServiceBodySchema,
  serviceListQuerySchema,
  serviceParamsSchema,
  updateServiceBodySchema,
  updateServiceStatusBodySchema,
} from "./services.validation.js";

function getClientIp(c: Context<AppBindings>): string | undefined {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip")
  );
}

function createTenantServicesErrorResponse(
  c: Context<AppBindings>,
  error: TenantServicesError,
) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function listTenantServicesController(c: Context<AppBindings>) {
  const query = serviceListQuerySchema.parse(c.req.query());
  const services = await listTenantServices(c.get("authContext"), query);

  return c.json(services);
}

export async function createTenantServiceController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createServiceBodySchema.parse(rawBody);

  try {
    const service = await createTenantService(c.get("authContext"), data, {
      ipAddress: getClientIp(c),
      userAgent: c.req.header("user-agent"),
    });

    return c.json(service, 201);
  } catch (error) {
    if (error instanceof TenantServicesError) {
      return createTenantServicesErrorResponse(c, error);
    }

    throw error;
  }
}

export async function getTenantServiceController(c: Context<AppBindings>) {
  const params = serviceParamsSchema.parse(c.req.param());

  try {
    const service = await getTenantServiceDetail(
      c.get("authContext"),
      params.serviceId,
    );

    return c.json(service);
  } catch (error) {
    if (error instanceof TenantServicesError) {
      return createTenantServicesErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateTenantServiceController(c: Context<AppBindings>) {
  const params = serviceParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateServiceBodySchema.parse(rawBody);

  try {
    const service = await updateTenantService(
      c.get("authContext"),
      params.serviceId,
      data,
      {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
    );

    return c.json(service);
  } catch (error) {
    if (error instanceof TenantServicesError) {
      return createTenantServicesErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateTenantServiceStatusController(
  c: Context<AppBindings>,
) {
  const params = serviceParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateServiceStatusBodySchema.parse(rawBody);

  try {
    const service = await updateTenantServiceStatus(
      c.get("authContext"),
      params.serviceId,
      data.status,
      {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
    );

    return c.json(service);
  } catch (error) {
    if (error instanceof TenantServicesError) {
      return createTenantServicesErrorResponse(c, error);
    }

    throw error;
  }
}

export async function deleteTenantServiceController(c: Context<AppBindings>) {
  const params = serviceParamsSchema.parse(c.req.param());

  try {
    await deleteTenantService(c.get("authContext"), params.serviceId, {
      ipAddress: getClientIp(c),
      userAgent: c.req.header("user-agent"),
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof TenantServicesError) {
      return createTenantServicesErrorResponse(c, error);
    }

    throw error;
  }
}
