import { getDb, type Database } from "@cleanhub/db";

import { requireSaasRole } from "../auth/permission.helper.js";
import { AuditError } from "./audit.errors.js";
import { findAuditLogById, findAuditLogs } from "./audit.repository.js";
import type {
  AuditLogDetail,
  GetAuditLogDetailInput,
  ListAuditLogsInput,
  ListAuditLogsResult,
} from "./audit.types.js";

export async function listAuditLogs(
  input: ListAuditLogsInput,
  db: Database = getDb(),
): Promise<ListAuditLogsResult> {
  requireSaasRole(input.authContext, ["super_admin", "support"]);

  return findAuditLogs(db, input.query);
}

export async function getAuditLogDetail(
  input: GetAuditLogDetailInput,
  db: Database = getDb(),
): Promise<AuditLogDetail> {
  requireSaasRole(input.authContext, ["super_admin", "support"]);

  const log = await findAuditLogById(db, input.logId);

  if (!log) {
    throw new AuditError("AUDIT_LOG_NOT_FOUND", "Audit log was not found.", 404);
  }

  return log;
}
