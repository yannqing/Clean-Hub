import { getDb, type Database } from "@cleanhub/db";

import { OperationLogError } from "./operation-logs.errors.js";
import {
  findOperationLogById,
  findOperationLogs,
} from "./operation-logs.repository.js";
import type {
  OperationLogDetail,
  OperationLogListInput,
  OperationLogListResult,
} from "./operation-logs.types.js";

export async function listOperationLogs(
  input: OperationLogListInput,
  db: Database = getDb(),
): Promise<OperationLogListResult> {
  return findOperationLogs(db, input);
}

export async function getOperationLogDetail(
  logId: string,
  db: Database = getDb(),
): Promise<OperationLogDetail> {
  const log = await findOperationLogById(db, logId);

  if (!log) {
    throw new OperationLogError(
      "OPERATION_LOG_NOT_FOUND",
      "Operation log was not found.",
      404,
    );
  }

  return log;
}
