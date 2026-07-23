import { auditLogs, getDb, type Database } from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import { and, eq } from "drizzle-orm";

import type { AuthContext } from "../../auth/auth.types.js";
import { AuthError } from "../../auth/auth.errors.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import {
  authorizePosSensitiveOperation,
  createPosAuditMetadata,
  requirePosBranchAccess,
  requirePosTenantId,
  resolvePosBranchScope,
} from "../access-control.helper.js";
import { findHardwareDevicesByBranch } from "./hardware.repository.js";
import type {
  AuthorizeManualDrawerOpenRequest,
  AuthorizePosHardwareActionInput,
  AuthorizePrivilegedReprintRequest,
  PosHardwareAction,
  PosHardwareActionAuthorization,
  PosHardwareDeviceSummary,
  PosPrintJobAuditResult,
  RecordPosPrintJobResultRequest,
} from "./hardware.types.js";

/**
 * List hardware devices for the current POS user's branch.
 * Any POS role (owner/manager/cashier) can read the device list.
 */
export async function listPosHardwareDevices(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<PosHardwareDeviceSummary[]> {
  const tenantId = requirePosTenantId(authContext);

  const branchId = resolvePosBranchScope(authContext)?.[0];
  if (!branchId) {
    return [];
  }

  return findHardwareDevicesByBranch(db, tenantId, branchId);
}

function requireHardwareTerminal(authContext: AuthContext): {
  tenantId: string;
  branchId: string;
  terminalId: string;
} {
  const tenantId = requirePosTenantId(authContext);
  if (!authContext.terminalId || !authContext.terminalBranchId) {
    throw new AuthError(
      "FORBIDDEN",
      "An enrolled POS terminal session is required for hardware actions.",
    );
  }
  requirePosBranchAccess(authContext, authContext.terminalBranchId);
  return {
    tenantId,
    branchId: authContext.terminalBranchId,
    terminalId: authContext.terminalId,
  };
}

async function authorizeHardwareAction(
  input: {
    authContext: AuthContext;
    requestMeta?: AuthorizePosHardwareActionInput<unknown>["requestMeta"];
    action: PosHardwareAction;
    reason: string;
    metadata?: Record<string, unknown>;
  },
  db: Database,
): Promise<PosHardwareActionAuthorization> {
  const reason = authorizePosSensitiveOperation(
    input.authContext,
    input.action,
    input.reason,
  );
  const terminal = requireHardwareTerminal(input.authContext);
  const authorization: PosHardwareActionAuthorization = {
    authorizationId: createId(),
    action: input.action,
    tenantId: terminal.tenantId,
    branchId: terminal.branchId,
    terminalId: terminal.terminalId,
    actorUserId: input.authContext.userId,
    reason,
    authorizedAt: new Date().toISOString(),
  };

  await writeAuditLog(db, {
    actorUserId: input.authContext.userId,
    tenantId: terminal.tenantId,
    branchId: terminal.branchId,
    eventCategory: "pos_hardware",
    eventType: `pos_hardware.${input.action}.authorized`,
    entityType: "pos_terminal_settings",
    entityId: terminal.terminalId,
    reason,
    after: { ...authorization },
    metadata: createPosAuditMetadata(input.authContext, {
      authorizationId: authorization.authorizationId,
      action: input.action,
      ...input.metadata,
    }),
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });

  return authorization;
}

export async function authorizeManualDrawerOpen(
  input: AuthorizePosHardwareActionInput<AuthorizeManualDrawerOpenRequest>,
  db: Database = getDb(),
): Promise<PosHardwareActionAuthorization> {
  return authorizeHardwareAction(
    {
      ...input,
      action: "manual_drawer_open",
      reason: input.data.reason,
    },
    db,
  );
}

export async function authorizePrivilegedReprint(
  input: AuthorizePosHardwareActionInput<AuthorizePrivilegedReprintRequest>,
  db: Database = getDb(),
): Promise<PosHardwareActionAuthorization> {
  return authorizeHardwareAction(
    {
      ...input,
      action: "privileged_reprint",
      reason: input.data.reason,
      metadata: {
        documentType: input.data.documentType,
        entityId: input.data.entityId,
        originalPrintJobId: input.data.originalPrintJobId,
      },
    },
    db,
  );
}

export async function recordPosPrintJobResult(
  input: AuthorizePosHardwareActionInput<RecordPosPrintJobResultRequest>,
  db: Database = getDb(),
): Promise<PosPrintJobAuditResult> {
  const terminal = requireHardwareTerminal(input.authContext);
  const eventType = `pos_hardware.print_job.${input.data.status}`;
  const existingEvents = await db
    .select({
      eventType: auditLogs.eventType,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, terminal.tenantId),
        eq(auditLogs.branchId, terminal.branchId),
        eq(auditLogs.entityType, "pos_print_job"),
        eq(auditLogs.entityId, input.data.jobId),
      ),
    );
  const alreadyRecorded = existingEvents.some(
    (event) =>
      event.eventType === eventType &&
      event.metadata?.attempt === input.data.attempt,
  );

  if (alreadyRecorded) {
    return {
      jobId: input.data.jobId,
      status: input.data.status,
      attempt: input.data.attempt,
      recorded: false,
      idempotent: true,
    };
  }

  await writeAuditLog(db, {
    actorUserId: input.authContext.userId,
    tenantId: terminal.tenantId,
    branchId: terminal.branchId,
    eventCategory: "pos_hardware",
    eventType,
    entityType: "pos_print_job",
    entityId: input.data.jobId,
    success: input.data.status === "printed",
    after: {
      jobId: input.data.jobId,
      documentType: input.data.documentType,
      documentEntityId: input.data.entityId,
      status: input.data.status,
      attempt: input.data.attempt,
      authorizationId: input.data.authorizationId,
      originalPrintJobId: input.data.originalPrintJobId,
    },
    metadata: createPosAuditMetadata(input.authContext, {
      jobId: input.data.jobId,
      documentType: input.data.documentType,
      documentEntityId: input.data.entityId,
      attempt: input.data.attempt,
      error: input.data.error,
      authorizationId: input.data.authorizationId,
      originalPrintJobId: input.data.originalPrintJobId,
    }),
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });

  return {
    jobId: input.data.jobId,
    status: input.data.status,
    attempt: input.data.attempt,
    recorded: true,
    idempotent: false,
  };
}
