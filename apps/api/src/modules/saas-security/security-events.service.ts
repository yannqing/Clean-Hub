import { getDb, type Database } from "@cleanhub/db";

import { findSecurityEvents } from "./security-events.repository.js";
import type {
  SecurityEventListInput,
  SecurityEventListItem,
} from "./security-events.types.js";

export async function listSecurityEvents(
  input: SecurityEventListInput,
  db: Database = getDb(),
): Promise<SecurityEventListItem[]> {
  return findSecurityEvents(db, input);
}
