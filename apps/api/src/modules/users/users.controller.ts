import { AuthError } from "../auth/auth.errors.js";
import {
  createSaasUser,
  deleteSaasUser,
  listSaasManagedUsers,
  listTenantUsers,
  updateSaasUser,
} from "./users.service.js";
import type { UserListInput } from "./users.types.js";
import type { AppBindings } from "../../http/types.js";
import {
  createSaasUserSchema,
  saasUserIdParamSchema,
  saasUserListQuerySchema,
  updateSaasUserSchema,
} from "./users.validation.js";

function canReadSaasUsers(role: string): boolean {
  return role === "super_admin" || role === "support";
}

function readUserListQuery(
  c: import("hono").Context<AppBindings>,
): Omit<UserListInput, "scope" | "tenantId"> {
  const limit = Number(c.req.query("limit") ?? 50);
  const offset = Number(c.req.query("offset") ?? 0);
  const status = c.req.query("status");

  return {
    q: c.req.query("q"),
    status:
      status === "invited" ||
      status === "active" ||
      status === "disabled" ||
      status === "suspended"
        ? status
        : undefined,
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 50,
    offset: Number.isFinite(offset) && offset >= 0 ? offset : 0,
  };
}

export async function listSaasUsersController(
  c: import("hono").Context<AppBindings>,
) {
  const authContext = c.get("authContext");

  if (!canReadSaasUsers(authContext.role)) {
    throw new AuthError("FORBIDDEN", "User cannot access SaaS users.");
  }

  const query = saasUserListQuerySchema.parse({
    q: c.req.query("q"),
    status: c.req.query("status"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const users = await listSaasManagedUsers(query);

  return c.json(users);
}

export async function createSaasUserController(
  c: import("hono").Context<AppBindings>,
) {
  const authContext = c.get("authContext");

  if (!canReadSaasUsers(authContext.role)) {
    throw new AuthError("FORBIDDEN", "User cannot create SaaS users.");
  }

  const body = createSaasUserSchema.parse(await c.req.json());
  const user = await createSaasUser(body, {
    actorUserId: authContext.userId,
  });

  return c.json(user, 201);
}

export async function updateSaasUserController(
  c: import("hono").Context<AppBindings>,
) {
  const authContext = c.get("authContext");

  if (!canReadSaasUsers(authContext.role)) {
    throw new AuthError("FORBIDDEN", "User cannot update SaaS users.");
  }

  const { userId } = saasUserIdParamSchema.parse(c.req.param());
  const body = updateSaasUserSchema.parse(await c.req.json());
  const user = await updateSaasUser(userId, body, {
    actorUserId: authContext.userId,
  });

  if (!user) {
    return c.json(
      {
        message: "User not found.",
        code: "NOT_FOUND",
        requestId: c.get("requestId"),
      },
      404,
    );
  }

  return c.json(user);
}

export async function deleteSaasUserController(
  c: import("hono").Context<AppBindings>,
) {
  const authContext = c.get("authContext");

  if (!canReadSaasUsers(authContext.role)) {
    throw new AuthError("FORBIDDEN", "User cannot delete SaaS users.");
  }

  const { userId } = saasUserIdParamSchema.parse(c.req.param());
  const user = await deleteSaasUser(userId, {
    actorUserId: authContext.userId,
  });

  if (!user) {
    return c.json(
      {
        message: "User not found.",
        code: "NOT_FOUND",
        requestId: c.get("requestId"),
      },
      404,
    );
  }

  return c.body(null, 204);
}

export async function listTenantUsersController(
  c: import("hono").Context<AppBindings>,
) {
  const authContext = c.get("authContext");

  if (!authContext.tenantId) {
    throw new AuthError("TOKEN_INVALID", "Tenant context is required.");
  }

  const query = readUserListQuery(c);
  const users = await listTenantUsers({
    ...query,
    tenantId: authContext.tenantId,
  });

  return c.json(users);
}
