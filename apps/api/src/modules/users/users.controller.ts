import type { Context } from "hono";

import { AuthError } from "../auth/auth.errors.js";
import { requireSaasRole, requireTenantRole } from "../auth/permission.helper.js";
import { UserError } from "./users.errors.js";
import {
  createTenantUser,
  disableTenantUser,
  getTenantUser,
  listSaasUsers,
  listTenantUsers,
  resetTenantUserPin,
  updateTenantUser,
} from "./users.service.js";
import type { AppBindings } from "../../http/types.js";
import {
  createTenantUserBodySchema,
  getTenantUserParamsSchema,
  listTenantUsersQuerySchema,
  updateTenantUserBodySchema,
} from "./users.validation.js";

function getRequestMeta(c: Context<AppBindings>) {
  return {
    ipAddress: c.req.header("x-forwarded-for") ?? c.req.header("cf-connecting-ip"),
    userAgent: c.req.header("user-agent"),
  };
}

function createUserErrorResponse(c: Context<AppBindings>, error: UserError) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function listSaasUsersController(
  c: Context<AppBindings>,
) {
  const authContext = c.get("authContext");

  requireSaasRole(authContext, ["super_admin", "support"]);

  const limit = Number(c.req.query("limit") ?? 50);
  const offset = Number(c.req.query("offset") ?? 0);
  const status = c.req.query("status");

  const query = {
    q: c.req.query("q"),
    status: (
      status === "invited" ||
      status === "active" ||
      status === "disabled" ||
      status === "suspended"
        ? status
        : undefined
    ) as "invited" | "active" | "disabled" | "suspended" | undefined,
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 50,
    offset: Number.isFinite(offset) && offset >= 0 ? offset : 0,
  };

  const users = await listSaasUsers(query);

  return c.json(users);
}

export async function listTenantUsersController(
  c: Context<AppBindings>,
) {
  const authContext = c.get("authContext");

  requireTenantRole(authContext, ["owner", "manager"]);

  if (!authContext.tenantId) {
    throw new AuthError("TOKEN_INVALID", "Tenant context is required.");
  }

  const query = listTenantUsersQuerySchema.parse(c.req.query());
  const users = await listTenantUsers({
    ...query,
    tenantId: authContext.tenantId,
  });

  return c.json(users);
}

export async function getTenantUserController(
  c: Context<AppBindings>,
) {
  const params = getTenantUserParamsSchema.parse(c.req.param());

  try {
    const user = await getTenantUser({
      authContext: c.get("authContext"),
      userId: params.userId,
    });

    return c.json(user);
  } catch (error) {
    if (error instanceof UserError) {
      return createUserErrorResponse(c, error);
    }

    throw error;
  }
}

export async function createTenantUserController(
  c: Context<AppBindings>,
) {
  const body = createTenantUserBodySchema.parse(await c.req.json());

  try {
    const user = await createTenantUser({
      authContext: c.get("authContext"),
      data: body,
      requestMeta: getRequestMeta(c),
    });

    return c.json(user, 201);
  } catch (error) {
    if (error instanceof UserError) {
      return createUserErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateTenantUserController(
  c: Context<AppBindings>,
) {
  const params = getTenantUserParamsSchema.parse(c.req.param());
  const body = updateTenantUserBodySchema.parse(await c.req.json());

  try {
    const user = await updateTenantUser({
      authContext: c.get("authContext"),
      userId: params.userId,
      data: body,
      requestMeta: getRequestMeta(c),
    });

    return c.json(user);
  } catch (error) {
    if (error instanceof UserError) {
      return createUserErrorResponse(c, error);
    }

    throw error;
  }
}

export async function disableTenantUserController(
  c: Context<AppBindings>,
) {
  const params = getTenantUserParamsSchema.parse(c.req.param());

  try {
    await disableTenantUser({
      authContext: c.get("authContext"),
      userId: params.userId,
      requestMeta: getRequestMeta(c),
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof UserError) {
      return createUserErrorResponse(c, error);
    }

    throw error;
  }
}

export async function resetTenantUserPinController(
  c: Context<AppBindings>,
) {
  const params = getTenantUserParamsSchema.parse(c.req.param());

  try {
    const result = await resetTenantUserPin({
      authContext: c.get("authContext"),
      userId: params.userId,
      requestMeta: getRequestMeta(c),
    });

    return c.json(result);
  } catch (error) {
    if (error instanceof UserError) {
      return createUserErrorResponse(c, error);
    }

    throw error;
  }
}
