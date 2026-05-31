import { getDb, type Database } from "@cleanhub/db";

import { requireTenantRole } from "../auth/permission.helper.js";
import { TenantAuditError } from "./audit.errors.js";
import {
  findTenantAuditLogById,
  findTenantAuditLogs,
} from "./audit.repository.js";
import type {
  GetTenantAuditLogDetailInput,
  ListTenantAuditLogsInput,
  TenantAuditLogDetail,
  TenantAuditLogListResult,
} from "./audit.types.js";

export async function listTenantAuditLogs(
  input: ListTenantAuditLogsInput,
  db: Database = getDb(),
): Promise<TenantAuditLogListResult> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  return findTenantAuditLogs(db, input.authContext.tenantId!, input.query);
}

export async function getTenantAuditLogDetail(
  input: GetTenantAuditLogDetailInput,
  db: Database = getDb(),
): Promise<TenantAuditLogDetail> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  const log = await findTenantAuditLogById(
    db,
    input.authContext.tenantId!,
    input.logId,
  );

  if (!log) {
    throw new TenantAuditError(
      "AUDIT_LOG_NOT_FOUND",
      "Audit log was not found.",
      404,
    );
  }

  return log;
}
