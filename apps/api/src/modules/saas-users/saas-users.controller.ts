import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";
import { listSaasUsers } from "./saas-users.service.js";
import { listSaasUsersQuerySchema } from "./saas-users.validation.js";

export async function listSaasUsersController(c: Context<AppBindings>) {
  const query = listSaasUsersQuerySchema.parse(c.req.query());
  const users = await listSaasUsers({
    authContext: c.get("authContext"),
    query,
  });

  return c.json(users);
}
