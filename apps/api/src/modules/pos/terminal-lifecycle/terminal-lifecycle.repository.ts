import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import {
  authRefreshTokens,
  posCashDrawerSessions,
  posRegisterSessions,
  posStaffShifts,
  posTerminalSettings,
  type Database,
} from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";

export type LockedPosTerminal = {
  id: string;
  branchId: string;
  deviceId: string;
  status: "active" | "inactive";
  credentialVersion: number;
  version: number;
};

export type SecurityForcedClosedShift = {
  id: string;
  branchId: string;
  terminalId: string | null;
  staffId: string;
  previousStatus: "open" | "on_break";
  previousVersion: number;
  version: number;
};

export type SecurityForcedClosedRegisterSession = {
  id: string;
  branchId: string;
  terminalId: string;
  previousVersion: number;
  version: number;
  cashDrawerSessionIds: string[];
};

type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Locks every existing terminal in a stable order before a branch status
 * mutation takes a branch-row lock. POS clock-in follows the same
 * terminal-first order, so an already-authenticated request either completes
 * first and is then closed by the lifecycle operation, or observes the new
 * terminal credential epoch and fails.
 */
export async function lockPosTerminalsForBranchStatusChange(
  db: Database,
  input: { tenantId: string; branchId: string },
): Promise<LockedPosTerminal[]> {
  return db
    .select({
      id: posTerminalSettings.id,
      branchId: posTerminalSettings.branchId,
      deviceId: posTerminalSettings.deviceId,
      status: posTerminalSettings.status,
      credentialVersion: posTerminalSettings.credentialVersion,
      version: posTerminalSettings.version,
    })
    .from(posTerminalSettings)
    .where(
      and(
        eq(posTerminalSettings.tenantId, input.tenantId),
        eq(posTerminalSettings.branchId, input.branchId),
      ),
    )
    .orderBy(asc(posTerminalSettings.id))
    .for("update");
}

export async function lockPosTerminalsForTenantStatusChange(
  db: Database,
  tenantId: string,
): Promise<LockedPosTerminal[]> {
  return db
    .select({
      id: posTerminalSettings.id,
      branchId: posTerminalSettings.branchId,
      deviceId: posTerminalSettings.deviceId,
      status: posTerminalSettings.status,
      credentialVersion: posTerminalSettings.credentialVersion,
      version: posTerminalSettings.version,
    })
    .from(posTerminalSettings)
    .where(eq(posTerminalSettings.tenantId, tenantId))
    .orderBy(asc(posTerminalSettings.id))
    .for("update");
}

/**
 * Security lifecycle callers must lock the affected terminal rows before
 * invoking this helper. That keeps the global order terminal -> shift and
 * serializes it with POS clock-in and terminal disable/revocation.
 *
 * A security close intentionally records no counted cash. The null closing
 * float plus the dedicated audit event tells operators that cash
 * reconciliation is still required.
 */
export async function securityForceClosePosTerminalShifts(
  db: Database,
  input: {
    tenantId: string;
    terminalIds: string[];
    staffId?: string;
    actorUserId: string;
    reason: string;
    metadata?: Record<string, unknown>;
    requestMeta?: RequestMeta;
  },
): Promise<SecurityForcedClosedShift[]> {
  if (input.terminalIds.length === 0) return [];

  const lockedShifts = await db
    .select({
      id: posStaffShifts.id,
      branchId: posStaffShifts.branchId,
      terminalId: posStaffShifts.terminalId,
      staffId: posStaffShifts.staffId,
      status: posStaffShifts.status,
      endedAt: posStaffShifts.endedAt,
      closingFloat: posStaffShifts.closingFloat,
      version: posStaffShifts.version,
    })
    .from(posStaffShifts)
    .where(
      and(
        eq(posStaffShifts.tenantId, input.tenantId),
        inArray(posStaffShifts.terminalId, input.terminalIds),
        input.staffId ? eq(posStaffShifts.staffId, input.staffId) : undefined,
        ne(posStaffShifts.status, "closed"),
      ),
    )
    .orderBy(asc(posStaffShifts.terminalId), asc(posStaffShifts.id))
    .for("update");

  if (lockedShifts.length === 0) return [];

  const closedAt = new Date();
  const closedRows = await db
    .update(posStaffShifts)
    .set({
      status: "closed",
      endedAt: closedAt,
      closingFloat: null,
      updatedAt: closedAt,
      updatedBy: input.actorUserId,
      version: sql`${posStaffShifts.version} + 1`,
    })
    .where(
      and(
        eq(posStaffShifts.tenantId, input.tenantId),
        inArray(
          posStaffShifts.id,
          lockedShifts.map((shift) => shift.id),
        ),
        input.staffId ? eq(posStaffShifts.staffId, input.staffId) : undefined,
        ne(posStaffShifts.status, "closed"),
      ),
    )
    .returning({
      id: posStaffShifts.id,
      version: posStaffShifts.version,
    });
  const closedVersions = new Map(
    closedRows.map((shift) => [shift.id, shift.version]),
  );

  if (closedVersions.size !== lockedShifts.length) {
    throw new Error(
      "One or more POS shifts changed while applying a security close.",
    );
  }

  const result: SecurityForcedClosedShift[] = [];
  for (const shift of lockedShifts) {
    if (shift.status === "closed") continue;
    const version = closedVersions.get(shift.id);
    if (version === undefined) continue;

    await writeAuditLog(db, {
      actorUserId: input.actorUserId,
      tenantId: input.tenantId,
      branchId: shift.branchId,
      eventCategory: "pos_shift",
      eventType: "pos.shift.security_forced_closed",
      entityType: "pos_staff_shift",
      entityId: shift.id,
      reason: input.reason,
      before: {
        status: shift.status,
        endedAt: shift.endedAt?.toISOString() ?? null,
        closingFloat: shift.closingFloat,
        version: shift.version,
      },
      after: {
        status: "closed",
        endedAt: closedAt.toISOString(),
        closingFloat: null,
        version,
      },
      metadata: {
        ...input.metadata,
        terminalId: shift.terminalId,
        staffId: shift.staffId,
        cashReconciliationRequired: true,
        closingFloatCaptured: false,
      },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    result.push({
      id: shift.id,
      branchId: shift.branchId,
      terminalId: shift.terminalId,
      staffId: shift.staffId,
      previousStatus: shift.status,
      previousVersion: shift.version,
      version,
    });
  }

  return result;
}

/**
 * Register sessions belong to a terminal rather than to one employee, so a
 * security close covers every session on the affected terminals. Revoking the
 * terminal credential would otherwise leave an open session that no operator
 * can reach to close.
 *
 * Like the shift close, this records no counted cash. The dedicated audit
 * event tells operators that cash reconciliation is still outstanding.
 */
export async function securityForceClosePosTerminalRegisterSessions(
  db: Database,
  input: {
    tenantId: string;
    terminalIds: string[];
    actorUserId: string;
    reason: string;
    metadata?: Record<string, unknown>;
    requestMeta?: RequestMeta;
  },
): Promise<SecurityForcedClosedRegisterSession[]> {
  if (input.terminalIds.length === 0) return [];

  const lockedSessions = await db
    .select({
      id: posRegisterSessions.id,
      branchId: posRegisterSessions.branchId,
      terminalId: posRegisterSessions.terminalId,
      status: posRegisterSessions.status,
      closedAt: posRegisterSessions.closedAt,
      version: posRegisterSessions.version,
    })
    .from(posRegisterSessions)
    .where(
      and(
        eq(posRegisterSessions.tenantId, input.tenantId),
        inArray(posRegisterSessions.terminalId, input.terminalIds),
        eq(posRegisterSessions.status, "open"),
      ),
    )
    .orderBy(asc(posRegisterSessions.terminalId), asc(posRegisterSessions.id))
    .for("update");

  if (lockedSessions.length === 0) return [];

  const sessionIds = lockedSessions.map((session) => session.id);
  const closedAt = new Date();

  const closedCashRows = await db
    .update(posCashDrawerSessions)
    .set({
      status: "closed",
      closedAt,
      closedBy: input.actorUserId,
      updatedAt: closedAt,
      version: sql`${posCashDrawerSessions.version} + 1`,
    })
    .where(
      and(
        eq(posCashDrawerSessions.tenantId, input.tenantId),
        inArray(posCashDrawerSessions.registerSessionId, sessionIds),
        eq(posCashDrawerSessions.status, "open"),
      ),
    )
    .returning({
      id: posCashDrawerSessions.id,
      registerSessionId: posCashDrawerSessions.registerSessionId,
    });
  const cashSessionsByRegister = new Map<string, string[]>();
  for (const row of closedCashRows) {
    const existing = cashSessionsByRegister.get(row.registerSessionId) ?? [];
    existing.push(row.id);
    cashSessionsByRegister.set(row.registerSessionId, existing);
  }

  const closedRows = await db
    .update(posRegisterSessions)
    .set({
      status: "closed",
      closedAt,
      closedBy: input.actorUserId,
      updatedAt: closedAt,
      version: sql`${posRegisterSessions.version} + 1`,
    })
    .where(
      and(
        eq(posRegisterSessions.tenantId, input.tenantId),
        inArray(posRegisterSessions.id, sessionIds),
        eq(posRegisterSessions.status, "open"),
      ),
    )
    .returning({
      id: posRegisterSessions.id,
      version: posRegisterSessions.version,
    });
  const closedVersions = new Map(
    closedRows.map((session) => [session.id, session.version]),
  );

  if (closedVersions.size !== lockedSessions.length) {
    throw new Error(
      "One or more POS register sessions changed while applying a security close.",
    );
  }

  const result: SecurityForcedClosedRegisterSession[] = [];
  for (const session of lockedSessions) {
    const version = closedVersions.get(session.id);
    if (version === undefined) continue;
    const cashDrawerSessionIds = cashSessionsByRegister.get(session.id) ?? [];

    await writeAuditLog(db, {
      actorUserId: input.actorUserId,
      tenantId: input.tenantId,
      branchId: session.branchId,
      eventCategory: "pos_register",
      eventType: "pos.register.security_forced_closed",
      entityType: "pos_register_session",
      entityId: session.id,
      reason: input.reason,
      before: {
        status: session.status,
        closedAt: session.closedAt?.toISOString() ?? null,
        version: session.version,
      },
      after: {
        status: "closed",
        closedAt: closedAt.toISOString(),
        version,
      },
      metadata: {
        ...input.metadata,
        terminalId: session.terminalId,
        cashDrawerSessionIds,
        cashReconciliationRequired: true,
        countedCashCaptured: false,
        zReportGenerated: false,
      },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    result.push({
      id: session.id,
      branchId: session.branchId,
      terminalId: session.terminalId,
      previousVersion: session.version,
      version,
      cashDrawerSessionIds,
    });
  }

  return result;
}

export async function invalidateLockedPosTerminalsForBranchStatusChange(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    branchStatus: "active" | "inactive";
    actorUserId: string;
    terminals: LockedPosTerminal[];
    requestMeta?: RequestMeta;
  },
): Promise<void> {
  if (input.terminals.length === 0) return;

  const terminalIds = input.terminals.map((terminal) => terminal.id);
  const changedAt = new Date();
  const updatedRows = await db
    .update(posTerminalSettings)
    .set({
      credentialVersion: sql`${posTerminalSettings.credentialVersion} + 1`,
      updatedAt: changedAt,
      updatedBy: input.actorUserId,
      version: sql`${posTerminalSettings.version} + 1`,
    })
    .where(
      and(
        eq(posTerminalSettings.tenantId, input.tenantId),
        eq(posTerminalSettings.branchId, input.branchId),
        inArray(posTerminalSettings.id, terminalIds),
      ),
    )
    .returning({
      id: posTerminalSettings.id,
      credentialVersion: posTerminalSettings.credentialVersion,
      version: posTerminalSettings.version,
    });
  const updatedById = new Map(updatedRows.map((row) => [row.id, row]));

  if (updatedById.size !== input.terminals.length) {
    throw new Error(
      "One or more POS terminals changed while applying a branch status change.",
    );
  }

  await db
    .update(authRefreshTokens)
    .set({ revokedAt: changedAt })
    .where(
      and(
        eq(authRefreshTokens.tenantId, input.tenantId),
        inArray(authRefreshTokens.terminalId, terminalIds),
        isNull(authRefreshTokens.revokedAt),
      ),
    );

  for (const terminal of input.terminals) {
    const updated = updatedById.get(terminal.id);
    if (!updated) continue;

    await writeAuditLog(db, {
      actorUserId: input.actorUserId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      eventCategory: "pos_terminal_security",
      eventType:
        input.branchStatus === "inactive"
          ? "pos_terminal.branch_disabled"
          : "pos_terminal.branch_enabled",
      entityType: "pos_terminal_settings",
      entityId: terminal.id,
      reason: `Branch was ${input.branchStatus === "inactive" ? "disabled" : "enabled"}.`,
      before: {
        branchStatus: input.branchStatus === "inactive" ? "active" : "inactive",
        terminalStatus: terminal.status,
        credentialVersion: terminal.credentialVersion,
        version: terminal.version,
      },
      after: {
        branchStatus: input.branchStatus,
        terminalStatus: terminal.status,
        credentialVersion: updated.credentialVersion,
        version: updated.version,
      },
      metadata: {
        terminalId: terminal.id,
        terminalDeviceId: terminal.deviceId,
        sessionEpochInvalidated: true,
      },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  }
}

export async function invalidateLockedPosTerminalsForTenantStatusChange(
  db: Database,
  input: {
    tenantId: string;
    previousTenantStatus: "active" | "suspended" | "disabled";
    tenantStatus: "active" | "suspended" | "disabled";
    actorUserId: string;
    reason: string;
    terminals: LockedPosTerminal[];
    requestMeta?: RequestMeta;
  },
): Promise<void> {
  if (input.terminals.length === 0) return;

  const terminalIds = input.terminals.map((terminal) => terminal.id);
  const changedAt = new Date();
  const updatedRows = await db
    .update(posTerminalSettings)
    .set({
      credentialVersion: sql`${posTerminalSettings.credentialVersion} + 1`,
      updatedAt: changedAt,
      updatedBy: input.actorUserId,
      version: sql`${posTerminalSettings.version} + 1`,
    })
    .where(
      and(
        eq(posTerminalSettings.tenantId, input.tenantId),
        inArray(posTerminalSettings.id, terminalIds),
      ),
    )
    .returning({
      id: posTerminalSettings.id,
      credentialVersion: posTerminalSettings.credentialVersion,
      version: posTerminalSettings.version,
    });
  const updatedById = new Map(updatedRows.map((row) => [row.id, row]));

  if (updatedById.size !== input.terminals.length) {
    throw new Error(
      "One or more POS terminals changed while applying a tenant status change.",
    );
  }

  await db
    .update(authRefreshTokens)
    .set({ revokedAt: changedAt })
    .where(
      and(
        eq(authRefreshTokens.tenantId, input.tenantId),
        inArray(authRefreshTokens.terminalId, terminalIds),
        isNull(authRefreshTokens.revokedAt),
      ),
    );

  for (const terminal of input.terminals) {
    const updated = updatedById.get(terminal.id);
    if (!updated) continue;

    await writeAuditLog(db, {
      actorUserId: input.actorUserId,
      tenantId: input.tenantId,
      branchId: terminal.branchId,
      eventCategory: "pos_terminal_security",
      eventType: `pos_terminal.tenant_${input.tenantStatus}`,
      entityType: "pos_terminal_settings",
      entityId: terminal.id,
      reason: input.reason,
      before: {
        tenantStatus: input.previousTenantStatus,
        terminalStatus: terminal.status,
        credentialVersion: terminal.credentialVersion,
        version: terminal.version,
      },
      after: {
        tenantStatus: input.tenantStatus,
        terminalStatus: terminal.status,
        credentialVersion: updated.credentialVersion,
        version: updated.version,
      },
      metadata: {
        terminalId: terminal.id,
        terminalDeviceId: terminal.deviceId,
        sessionEpochInvalidated: true,
      },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  }
}
