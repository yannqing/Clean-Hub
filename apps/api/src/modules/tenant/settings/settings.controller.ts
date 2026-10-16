import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { TenantSettingsError } from "./settings.errors.js";
import {
  getTenantSettings,
  updateTenantSettings,
} from "./settings.service.js";
import { updateTenantSettingsBodySchema } from "./settings.validation.js";

function getClientIp(c: Context<AppBindings>): string | undefined {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip")
  );
}

function createTenantSettingsErrorResponse(
  c: Context<AppBindings>,
  error: TenantSettingsError,
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

export async function getTenantSettingsController(c: Context<AppBindings>) {
  try {
    const settings = await getTenantSettings({
      authContext: c.get("authContext"),
    });

    return c.json(settings);
  } catch (error) {
    if (error instanceof TenantSettingsError) {
      return createTenantSettingsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateTenantSettingsController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateTenantSettingsBodySchema.parse(rawBody);

  try {
    const settings = await updateTenantSettings({
      authContext: c.get("authContext"),
      requestMeta: {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
      data,
    });

    return c.json(settings);
  } catch (error) {
    if (error instanceof TenantSettingsError) {
      return createTenantSettingsErrorResponse(c, error);
    }

    throw error;
  }
}
