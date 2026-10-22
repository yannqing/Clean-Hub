import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getMyPosBranch } from "./pos.service.js";

export async function getMyPosBranchController(c: Context<AppBindings>) {
  const branch = await getMyPosBranch({
    authContext: c.get("authContext"),
  });

  return c.json(branch);
}
