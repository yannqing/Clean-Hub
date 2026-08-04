import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { TenantUserError } from "./tenant-users.errors.js";
import {
  createTenantUser,
  getTenantUser,
  listTenantUsers,
  resetTenantUserPassword,
  resetTenantUserPin,
  updateTenantUser,
  updateTenantUserStatus,
} from "./tenant-users.service.js";
import {
  createTenantUserBodySchema,
  getTenantUserParamsSchema,
  listTenantUsersQuerySchema,
  resetTenantUserPasswordBodySchema,
  resetTenantUserPinBodySchema,
  updateTenantUserBodySchema,
  updateTenantUserStatusBodySchema,
} from "./tenant-users.validation.js";

function getRequestMeta(c: Context<AppBindings>) {
  return {
    ipAddress:
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
  };
}

function tenantUserErrorResponse(
  c: Context<AppBindings>,
  error: TenantUserError,
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

async function handleTenantUserError<T>(
  c: Context<AppBindings>,
  operation: () => Promise<T>,
): Promise<T | ReturnType<typeof tenantUserErrorResponse>> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TenantUserError) {
      return tenantUserErrorResponse(c, error);
    }
    throw error;
  }
}

export async function listTenantUsersController(c: Context<AppBindings>) {
  const query = listTenantUsersQuerySchema.parse(c.req.query());
  return c.json(
    await listTenantUsers({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      query,
    }),
  );
}

export async function getTenantUserController(c: Context<AppBindings>) {
  const { userId } = getTenantUserParamsSchema.parse(c.req.param());
  const result = await handleTenantUserError(c, () =>
    getTenantUser({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      userId,
    }),
  );
  return result instanceof Response ? result : c.json(result);
}

export async function createTenantUserController(c: Context<AppBindings>) {
  const data = createTenantUserBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  const result = await handleTenantUserError(c, () =>
    createTenantUser({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data,
    }),
  );
  return result instanceof Response ? result : c.json(result, 201);
}

export async function updateTenantUserController(c: Context<AppBindings>) {
  const { userId } = getTenantUserParamsSchema.parse(c.req.param());
  const data = updateTenantUserBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  const result = await handleTenantUserError(c, () =>
    updateTenantUser({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      userId,
      data,
    }),
  );
  return result instanceof Response ? result : c.json(result);
}

export async function updateTenantUserStatusController(
  c: Context<AppBindings>,
) {
  const { userId } = getTenantUserParamsSchema.parse(c.req.param());
  const data = updateTenantUserStatusBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  const result = await handleTenantUserError(c, () =>
    updateTenantUserStatus({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      userId,
      data,
    }),
  );
  return result instanceof Response ? result : c.json(result);
}

export async function resetTenantUserPinController(c: Context<AppBindings>) {
  const { userId } = getTenantUserParamsSchema.parse(c.req.param());
  const data = resetTenantUserPinBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  const result = await handleTenantUserError(c, async () => {
    await resetTenantUserPin({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      userId,
      data,
    });
    return null;
  });
  return result instanceof Response ? result : c.body(null, 204);
}

export async function resetTenantUserPasswordController(
  c: Context<AppBindings>,
) {
  const { userId } = getTenantUserParamsSchema.parse(c.req.param());
  const data = resetTenantUserPasswordBodySchema.parse(
    await c.req.json().catch(() => ({})),
  );
  const result = await handleTenantUserError(c, async () => {
    await resetTenantUserPassword({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      userId,
      data,
    });
    return null;
  });
  return result instanceof Response ? result : c.body(null, 204);
}
