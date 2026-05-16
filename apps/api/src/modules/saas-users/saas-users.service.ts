import { getDb, type Database } from "@cleanhub/db";

import { requireSaasRole } from "../auth/permission.helper.js";
import { findSaasUsers } from "./saas-users.repository.js";
import type { ListSaasUsersInput, SaasUserListItem } from "./saas-users.types.js";

export async function listSaasUsers(
  input: ListSaasUsersInput,
  db: Database = getDb(),
): Promise<SaasUserListItem[]> {
  requireSaasRole(input.authContext, ["super_admin", "support"]);

  return findSaasUsers(db, input.query);
}
