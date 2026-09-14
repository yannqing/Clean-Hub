import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { SaasTenantsError } from "./tenants.errors.js";
import {
  createSaasTenant,
  exportSaasTenant,
  getSaasTenantDetail,
  getSaasTenantFeatureFlags,
  getSaasTenantSettings,
  listSaasTenants,
  offboardSaasTenant,
  restoreSaasTenant,
  updateSaasTenant,
  updateSaasTenantFeatureFlags,
  updateSaasTenantSettings,
  updateSaasTenantStatus,
} from "./tenants.service.js";
import {
  createSaasTenantBodySchema,
  getSaasTenantParamsSchema,
  listSaasTenantsQuerySchema,
  offboardSaasTenantBodySchema,
  restoreSaasTenantBodySchema,
  updateSaasTenantBodySchema,
  updateSaasTenantFeatureFlagsBodySchema,
  updateSaasTenantSettingsBodySchema,
  updateSaasTenantStatusBodySchema,
} from "./tenants.validation.js";

function getClientIp(c: Context<AppBindings>): string | undefined {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip")
  );
}

function createSaasTenantsErrorResponse(
  c: Context<AppBindings>,
  error: SaasTenantsError,
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

export async function listSaasTenantsController(c: Context<AppBindings>) {
  const query = listSaasTenantsQuerySchema.parse(c.req.query());
  const result = await listSaasTenants({
    authContext: c.get("authContext"),
    query,
  });

  return c.json({
    data: result.items,
    meta: {
      total: result.total,
      statusCounts: result.statusCounts,
      limit: query.limit,
      offset: query.offset,
    },
  });
}

export async function getSaasTenantController(c: Context<AppBindings>) {
  const params = getSaasTenantParamsSchema.parse(c.req.param());

  try {
    const tenant = await getSaasTenantDetail({
      authContext: c.get("authContext"),
      tenantId: params.tenantId,
    });

    return c.json(tenant);
  } catch (error) {
    if (error instanceof SaasTenantsError) {
      return createSaasTenantsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function createSaasTenantController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createSaasTenantBodySchema.parse(rawBody);

  try {
    const tenant = await createSaasTenant({
      authContext: c.get("authContext"),
      requestMeta: {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
      data,
    });

    return c.json(tenant, 201);
  } catch (error) {
    if (error instanceof SaasTenantsError) {
      return createSaasTenantsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateSaasTenantController(c: Context<AppBindings>) {
  const params = getSaasTenantParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateSaasTenantBodySchema.parse(rawBody);

  try {
    const tenant = await updateSaasTenant({
      authContext: c.get("authContext"),
      requestMeta: {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
      tenantId: params.tenantId,
      data,
    });

    return c.json(tenant);
  } catch (error) {
    if (error instanceof SaasTenantsError) {
      return createSaasTenantsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function getSaasTenantSettingsController(c: Context<AppBindings>) {
  const params = getSaasTenantParamsSchema.parse(c.req.param());

  try {
    const settings = await getSaasTenantSettings({
      authContext: c.get("authContext"),
      tenantId: params.tenantId,
    });

    return c.json(settings);
  } catch (error) {
    if (error instanceof SaasTenantsError) {
      return createSaasTenantsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateSaasTenantSettingsController(
  c: Context<AppBindings>,
) {
  const params = getSaasTenantParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateSaasTenantSettingsBodySchema.parse(rawBody);

  try {
    const settings = await updateSaasTenantSettings({
      authContext: c.get("authContext"),
      requestMeta: {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
      tenantId: params.tenantId,
      data,
    });

    return c.json(settings);
  } catch (error) {
    if (error instanceof SaasTenantsError) {
      return createSaasTenantsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function getSaasTenantFeatureFlagsController(
  c: Context<AppBindings>,
) {
  const params = getSaasTenantParamsSchema.parse(c.req.param());

  try {
    const featureFlags = await getSaasTenantFeatureFlags({
      authContext: c.get("authContext"),
      tenantId: params.tenantId,
    });

    return c.json(featureFlags);
  } catch (error) {
    if (error instanceof SaasTenantsError) {
      return createSaasTenantsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateSaasTenantFeatureFlagsController(
  c: Context<AppBindings>,
) {
  const params = getSaasTenantParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateSaasTenantFeatureFlagsBodySchema.parse(rawBody);

  try {
    const featureFlags = await updateSaasTenantFeatureFlags({
      authContext: c.get("authContext"),
      requestMeta: {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
      tenantId: params.tenantId,
      data,
    });

    return c.json(featureFlags);
  } catch (error) {
    if (error instanceof SaasTenantsError) {
      return createSaasTenantsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateSaasTenantStatusController(c: Context<AppBindings>) {
  const params = getSaasTenantParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateSaasTenantStatusBodySchema.parse(rawBody);

  try {
    const tenant = await updateSaasTenantStatus({
      authContext: c.get("authContext"),
      requestMeta: {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
      tenantId: params.tenantId,
      data,
    });

    return c.json(tenant);
  } catch (error) {
    if (error instanceof SaasTenantsError) {
      return createSaasTenantsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function offboardSaasTenantController(c: Context<AppBindings>) {
  const params = getSaasTenantParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = offboardSaasTenantBodySchema.parse(rawBody);

  try {
    const result = await offboardSaasTenant({
      authContext: c.get("authContext"),
      requestMeta: {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
      tenantId: params.tenantId,
      data,
    });

    // The archive itself is not returned here: it can be megabytes, and this
    // response is what the console renders. The operator downloads it from the
    // export endpoint, which the console offers alongside the confirmation.
    return c.json({
      tenant: result.tenant,
      exportedTables: result.export.tables.length,
    });
  } catch (error) {
    if (error instanceof SaasTenantsError) {
      return createSaasTenantsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function restoreSaasTenantController(c: Context<AppBindings>) {
  const params = getSaasTenantParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = restoreSaasTenantBodySchema.parse(rawBody);

  try {
    const tenant = await restoreSaasTenant({
      authContext: c.get("authContext"),
      requestMeta: {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
      tenantId: params.tenantId,
      data,
    });

    return c.json(tenant);
  } catch (error) {
    if (error instanceof SaasTenantsError) {
      return createSaasTenantsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function exportSaasTenantController(c: Context<AppBindings>) {
  const params = getSaasTenantParamsSchema.parse(c.req.param());

  try {
    const result = await exportSaasTenant({
      authContext: c.get("authContext"),
      requestMeta: {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
      tenantId: params.tenantId,
    });

    c.header("Content-Type", "application/zip");
    c.header(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`,
    );

    return c.body(result.content as unknown as ArrayBuffer);
  } catch (error) {
    if (error instanceof SaasTenantsError) {
      return createSaasTenantsErrorResponse(c, error);
    }

    throw error;
  }
}
