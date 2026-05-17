import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  createSaasUser,
  getSaasUserDetail,
  listSaasUsers,
  updateSaasUser,
} from "./saas-users.service.js";
import { SaasUsersError } from "./saas-users.errors.js";
import {
  createSaasUserBodySchema,
  getSaasUserParamsSchema,
  listSaasUsersQuerySchema,
  updateSaasUserBodySchema,
} from "./saas-users.validation.js";

function getClientIp(c: Context<AppBindings>): string | undefined {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip")
  );
}

function createSaasUsersErrorResponse(
  c: Context<AppBindings>,
  error: SaasUsersError,
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

export async function listSaasUsersController(c: Context<AppBindings>) {
  const query = listSaasUsersQuerySchema.parse(c.req.query());
  const users = await listSaasUsers({
    authContext: c.get("authContext"),
    query,
  });

  return c.json(users);
}

export async function getSaasUserController(c: Context<AppBindings>) {
  const params = getSaasUserParamsSchema.parse(c.req.param());

  try {
    const user = await getSaasUserDetail({
      authContext: c.get("authContext"),
      userId: params.userId,
    });

    return c.json(user);
  } catch (error) {
    if (error instanceof SaasUsersError) {
      return createSaasUsersErrorResponse(c, error);
    }

    throw error;
  }
}

export async function createSaasUserController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createSaasUserBodySchema.parse(rawBody);

  try {
    const user = await createSaasUser({
      authContext: c.get("authContext"),
      requestMeta: {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
      data,
    });

    return c.json(user, 201);
  } catch (error) {
    if (error instanceof SaasUsersError) {
      return createSaasUsersErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateSaasUserController(c: Context<AppBindings>) {
  const params = getSaasUserParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateSaasUserBodySchema.parse(rawBody);

  try {
    const user = await updateSaasUser({
      authContext: c.get("authContext"),
      requestMeta: {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
      userId: params.userId,
      data,
    });

    return c.json(user);
  } catch (error) {
    if (error instanceof SaasUsersError) {
      return createSaasUsersErrorResponse(c, error);
    }

    throw error;
  }
}
