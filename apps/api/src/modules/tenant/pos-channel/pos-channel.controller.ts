import type { Context } from "hono";

import { getRequestMeta } from "../../../http/request-meta.js";
import type { AppBindings } from "../../../http/types.js";
import { TenantPosChannelError } from "./pos-channel.errors.js";
import {
  getTenantPosChannelOverview,
  getTenantPosChannelSettings,
  listTenantPosChannelDevices,
  listTenantPosChannelRegisterSessions,
  updateTenantPosChannelSettings,
} from "./pos-channel.service.js";
import {
  posChannelDeviceListQuerySchema,
  posChannelOverviewQuerySchema,
  posChannelRegisterSessionQuerySchema,
  updatePosChannelSettingsBodySchema,
} from "./pos-channel.validation.js";

function createErrorResponse(
  c: Context<AppBindings>,
  error: TenantPosChannelError,
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

export async function getTenantPosChannelOverviewController(
  c: Context<AppBindings>,
) {
  const query = posChannelOverviewQuerySchema.parse(c.req.query());

  try {
    return c.json(
      await getTenantPosChannelOverview(c.get("authContext"), query),
    );
  } catch (error) {
    if (error instanceof TenantPosChannelError) {
      return createErrorResponse(c, error);
    }

    throw error;
  }
}

export async function listTenantPosChannelDevicesController(
  c: Context<AppBindings>,
) {
  const query = posChannelDeviceListQuerySchema.parse(c.req.query());

  try {
    return c.json(
      await listTenantPosChannelDevices(c.get("authContext"), query),
    );
  } catch (error) {
    if (error instanceof TenantPosChannelError) {
      return createErrorResponse(c, error);
    }

    throw error;
  }
}

export async function listTenantPosChannelRegisterSessionsController(
  c: Context<AppBindings>,
) {
  const query = posChannelRegisterSessionQuerySchema.parse(c.req.query());

  try {
    return c.json(
      await listTenantPosChannelRegisterSessions(c.get("authContext"), query),
    );
  } catch (error) {
    if (error instanceof TenantPosChannelError) {
      return createErrorResponse(c, error);
    }

    throw error;
  }
}

export async function getTenantPosChannelSettingsController(
  c: Context<AppBindings>,
) {
  try {
    return c.json(await getTenantPosChannelSettings(c.get("authContext")));
  } catch (error) {
    if (error instanceof TenantPosChannelError) {
      return createErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateTenantPosChannelSettingsController(
  c: Context<AppBindings>,
) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updatePosChannelSettingsBodySchema.parse(rawBody);

  try {
    return c.json(
      await updateTenantPosChannelSettings({
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        data,
      }),
    );
  } catch (error) {
    if (error instanceof TenantPosChannelError) {
      return createErrorResponse(c, error);
    }

    throw error;
  }
}
