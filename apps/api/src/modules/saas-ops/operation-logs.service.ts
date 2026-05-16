import { getDb, type Database } from "@cleanhub/db";

import { findOperationLogs } from "./operation-logs.repository.js";
import type {
  OperationLogListInput,
  OperationLogListItem,
} from "./operation-logs.types.js";

export async function listOperationLogs(
  input: OperationLogListInput,
  db: Database = getDb(),
): Promise<OperationLogListItem[]> {
  return findOperationLogs(db, input);
}
