import { AuthError } from "../auth/auth.errors.js";
import { requireSaasOperation } from "../auth/permission.helper.js";
import { listSaasUsers, listTenantUsers } from "./users.service.js";
import type { UserListInput } from "./users.types.js";
import type { AppBindings } from "../../http/types.js";

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

  requireSaasOperation(authContext, "saas.users.read");

  const query = readUserListQuery(c);
  const users = await listSaasUsers(query);

  return c.json(users);
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
