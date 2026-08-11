import type { Context } from "hono";
import { getCookie } from "hono/cookie";

import { getRequestMeta } from "../../../http/request-meta.js";
import type { AppBindings } from "../../../http/types.js";
import { REFRESH_COOKIE_NAME } from "../../auth/cookie.service.js";
import { TenantProfileError } from "./profile.errors.js";
import {
  changeTenantSelfPassword,
  getTenantLoginSessions,
  getTenantSelfProfile,
  revokeTenantLoginSession,
  updateTenantSelfProfile,
} from "./profile.service.js";
import {
  changeTenantProfilePasswordBodySchema,
  tenantLoginSessionParamsSchema,
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

export async function getTenantSelfProfileController(c: Context<AppBindings>) {
  try {
    return c.json(await getTenantSelfProfile(c.get("authContext")));
  } catch (error) {
    if (error instanceof TenantProfileError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function getTenantLoginSessionsController(
  c: Context<AppBindings>,
) {
  try {
    return c.json(
      await getTenantLoginSessions({
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        refreshToken: getCookie(c, REFRESH_COOKIE_NAME),
      }),
    );
  } catch (error) {
    if (error instanceof TenantProfileError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function revokeTenantLoginSessionController(
  c: Context<AppBindings>,
) {
  const { sessionId } = tenantLoginSessionParamsSchema.parse(c.req.param());

  try {
    return c.json(
      await revokeTenantLoginSession({
        authContext: c.get("authContext"),
        requestMeta: getRequestMeta(c),
        refreshToken: getCookie(c, REFRESH_COOKIE_NAME),
        sessionId,
      }),
    );
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
