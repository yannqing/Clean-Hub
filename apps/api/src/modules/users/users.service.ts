import { getDb, type Database } from "@cleanhub/db";

import { findUsers } from "./users.repository.js";
import type { UserListInput, UserListItem } from "./users.types.js";

export async function listSaasUsers(
  input: Omit<UserListInput, "scope" | "tenantId">,
  db: Database = getDb(),
): Promise<UserListItem[]> {
  return findUsers(db, {
    ...input,
    scope: "saas",
  });
}

export async function listTenantUsers(
  input: Omit<UserListInput, "scope"> & { tenantId: string },
  db: Database = getDb(),
): Promise<UserListItem[]> {
  return findUsers(db, {
    ...input,
    scope: "tenant",
  });
}
