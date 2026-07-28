import type { Context } from "hono";

import { getRequestMeta } from "../../../http/request-meta.js";
import type { AppBindings } from "../../../http/types.js";
import { TenantProfileError } from "./profile.errors.js";
import {
  changeTenantSelfPassword,
  getTenantSelfProfile,
  updateTenantSelfProfile,
} from "./profile.service.js";
import {
  changeTenantProfilePasswordBodySchema,
  updateTenantProfileBodySchema,
} from "./profile.validation.js";

function createErrorResponse(
  c: Context<AppBindings>,
  error: TenantProfileError,
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

export async function getTenantSelfProfileController(
  c: Context<AppBindings>,
) {
  try {
    return c.json(await getTenantSelfProfile(c.get("authContext")));
  } catch (error) {
    if (error instanceof TenantProfileError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function updateTenantSelfProfileController(
  c: Context<AppBindings>,
) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateTenantProfileBodySchema.parse(rawBody);

  try {
    return c.json(
      await updateTenantSelfProfile({
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        data,
      }),
    );
  } catch (error) {
    if (error instanceof TenantProfileError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function changeTenantSelfPasswordController(
  c: Context<AppBindings>,
) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = changeTenantProfilePasswordBodySchema.parse(rawBody);

  try {
    return c.json(
      await changeTenantSelfPassword({
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        data,
      }),
    );
  } catch (error) {
    if (error instanceof TenantProfileError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

