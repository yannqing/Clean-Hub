import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { TenantPaymentIntegrationError } from "./payment-integrations.errors.js";
import {
  configureTenantPaymentIntegration,
  deleteTenantPaymentIntegration,
  listTenantPaymentIntegrations,
  updateTenantPaymentIntegration,
  verifyTenantPaymentIntegration,
} from "./payment-integrations.service.js";
import {
  configureOrangeMoneyPaymentIntegrationBodySchema,
  configureWavePaymentIntegrationBodySchema,
  tenantPaymentProviderSchema,
  updatePaymentIntegrationBodySchema,
} from "./payment-integrations.validation.js";
import type { ConfigureTenantPaymentIntegrationRequest } from "./payment-integrations.types.js";

function requestMeta(c: Context<AppBindings>) {
  return {
    ipAddress:
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
  };
}

function errorResponse(
  c: Context<AppBindings>,
  error: TenantPaymentIntegrationError,
) {
  return c.json(
    { message: error.message, code: error.code, requestId: c.get("requestId") },
    error.status,
  );
}

export async function listTenantPaymentIntegrationsController(
  c: Context<AppBindings>,
) {
  try {
    return c.json(
      await listTenantPaymentIntegrations({
        authContext: c.get("authContext"),
      }),
    );
  } catch (error) {
    if (error instanceof TenantPaymentIntegrationError)
      return errorResponse(c, error);
    throw error;
  }
}

export async function configureTenantPaymentIntegrationController(
  c: Context<AppBindings>,
) {
  const provider = tenantPaymentProviderSchema.parse(c.req.param("provider"));
  const rawBody = await c.req.json().catch(() => ({}));
  const data: ConfigureTenantPaymentIntegrationRequest =
    provider === "wave"
      ? {
          ...configureWavePaymentIntegrationBodySchema.parse(rawBody),
          provider: "wave",
        }
      : {
          ...configureOrangeMoneyPaymentIntegrationBodySchema.parse(rawBody),
          provider: "orange_money",
        };

  try {
    return c.json(
      await configureTenantPaymentIntegration({
        authContext: c.get("authContext"),
        requestMeta: requestMeta(c),
        provider,
        data,
      }),
    );
  } catch (error) {
    if (error instanceof TenantPaymentIntegrationError)
      return errorResponse(c, error);
    throw error;
  }
}

export async function verifyTenantPaymentIntegrationController(
  c: Context<AppBindings>,
) {
  const provider = tenantPaymentProviderSchema.parse(c.req.param("provider"));
  try {
    return c.json(
      await verifyTenantPaymentIntegration({
        authContext: c.get("authContext"),
        requestMeta: requestMeta(c),
        provider,
        data: undefined,
      }),
    );
  } catch (error) {
    if (error instanceof TenantPaymentIntegrationError)
      return errorResponse(c, error);
    throw error;
  }
}

export async function updateTenantPaymentIntegrationController(
  c: Context<AppBindings>,
) {
  const provider = tenantPaymentProviderSchema.parse(c.req.param("provider"));
  const data = updatePaymentIntegrationBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  try {
    return c.json(
      await updateTenantPaymentIntegration({
        authContext: c.get("authContext"),
        requestMeta: requestMeta(c),
        provider,
        data,
      }),
    );
  } catch (error) {
    if (error instanceof TenantPaymentIntegrationError)
      return errorResponse(c, error);
    throw error;
  }
}

export async function deleteTenantPaymentIntegrationController(
  c: Context<AppBindings>,
) {
  const provider = tenantPaymentProviderSchema.parse(c.req.param("provider"));
  try {
    return c.json(
      await deleteTenantPaymentIntegration({
        authContext: c.get("authContext"),
        requestMeta: requestMeta(c),
        provider,
        data: undefined,
      }),
    );
  } catch (error) {
    if (error instanceof TenantPaymentIntegrationError)
      return errorResponse(c, error);
    throw error;
  }
}
