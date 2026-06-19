import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { TenantUserError } from "./tenant-users.errors.js";
import {
  createTenantUser,
  disableTenantUser,
  enableTenantUser,
  getTenantUser,
  listTenantUsers,
  resetTenantUserPin,
  updateTenantUser,
} from "./tenant-users.service.js";
import {
  createTenantUserBodySchema,
  getTenantUserParamsSchema,
  listTenantUsersQuerySchema,
  resetTenantUserPinBodySchema,
  updateTenantUserBodySchema,
} from "./tenant-users.validation.js";

function getClientIp(c: Context<AppBindings>): string | undefined {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip")
  );
}

function createTenantUserErrorResponse(
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

export async function listTenantUsersController(c: Context<AppBindings>) {
  const query = listTenantUsersQuerySchema.parse(c.req.query());
  const result = await listTenantUsers({
    authContext: c.get("authContext"),
    query,
  });

  return c.json(result);
}

export async function getTenantUserController(c: Context<AppBindings>) {
  const params = getTenantUserParamsSchema.parse(c.req.param());

  try {
    const user = await getTenantUser({
      authContext: c.get("authContext"),
      userId: params.userId,
    });

    return c.json(user);
  } catch (error) {
    if (error instanceof TenantUserError) {
      return createTenantUserErrorResponse(c, error);
    }

    throw error;
  }
}

export async function createTenantUserController(c: Context<AppBindings>) {
  const body = createTenantUserBodySchema.parse(await c.req.json());

  try {
    const user = await createTenantUser({
      authContext: c.get("authContext"),
      displayName: body.displayName,
      email: body.email,
      phone: body.phone,
      roleCode: body.roleCode,
      branchIds: body.branchIds,
      initialPin: body.initialPin,
      ipAddress: getClientIp(c),
      userAgent: c.req.header("user-agent"),
    });

    return c.json(user, 201);
  } catch (error) {
    if (error instanceof TenantUserError) {
      return createTenantUserErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateTenantUserController(c: Context<AppBindings>) {
  const params = getTenantUserParamsSchema.parse(c.req.param());
  const body = updateTenantUserBodySchema.parse(await c.req.json());

  try {
    const user = await updateTenantUser({
      authContext: c.get("authContext"),
      userId: params.userId,
      displayName: body.displayName,
      phone: body.phone,
      branchIds: body.branchIds,
      roleCode: body.roleCode,
      ipAddress: getClientIp(c),
      userAgent: c.req.header("user-agent"),
    });

    return c.json(user);
  } catch (error) {
    if (error instanceof TenantUserError) {
      return createTenantUserErrorResponse(c, error);
    }

    throw error;
  }
}

export async function disableTenantUserController(c: Context<AppBindings>) {
  const params = getTenantUserParamsSchema.parse(c.req.param());

  try {
    await disableTenantUser({
      authContext: c.get("authContext"),
      userId: params.userId,
      ipAddress: getClientIp(c),
      userAgent: c.req.header("user-agent"),
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof TenantUserError) {
      return createTenantUserErrorResponse(c, error);
    }

    throw error;
  }
}

export async function enableTenantUserController(c: Context<AppBindings>) {
  const params = getTenantUserParamsSchema.parse(c.req.param());

  try {
    await enableTenantUser({
      authContext: c.get("authContext"),
      userId: params.userId,
      ipAddress: getClientIp(c),
      userAgent: c.req.header("user-agent"),
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof TenantUserError) {
      return createTenantUserErrorResponse(c, error);
    }

    throw error;
  }
}

export async function resetTenantUserPinController(c: Context<AppBindings>) {
  const params = getTenantUserParamsSchema.parse(c.req.param());
  const body = resetTenantUserPinBodySchema.parse(await c.req.json());

  try {
    const result = await resetTenantUserPin({
      authContext: c.get("authContext"),
      userId: params.userId,
      reason: body.reason,
      ipAddress: getClientIp(c),
      userAgent: c.req.header("user-agent"),
    });

    return c.json(result);
  } catch (error) {
    if (error instanceof TenantUserError) {
      return createTenantUserErrorResponse(c, error);
    }

    throw error;
  }
}
