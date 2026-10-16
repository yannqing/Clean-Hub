import type { Database } from "@cleanhub/db";

import { insertOperationLog } from "./operation-logs.repository.js";
import type { WriteOperationLogInput } from "./operation-logs.types.js";

export async function writeOperationLog(
  db: Database,
  input: WriteOperationLogInput,
): Promise<void> {
  await insertOperationLog(db, input);
}
