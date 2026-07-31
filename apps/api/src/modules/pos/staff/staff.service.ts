import { getDb, type Database } from "@cleanhub/db";

import { AuthError } from "../../auth/auth.errors.js";
import type { AuthContext } from "../../auth/auth.types.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import {
  createPosAuditMetadata,
  requirePosBranchAccess,
  requirePosTenantId,
} from "../access-control.helper.js";
import { PosStaffError } from "./staff.errors.js";
import {
  calculateHandoverSnapshot,
  createHandoverAndZReport,
  createShiftRecord,
  findActiveBranchCurrency,
  findOpenShift,
  findOpenShiftForUpdate,
  findPosTerminalForShiftUpdate,
  findStaffForBranch,
  findZReport,
  listZReports,
  transitionShiftRecord,
} from "./staff.repository.js";
import type {
  ClockInput,
  CreateHandoverInput,
  HandoverRecord,
  PosStaffDetail,
  PosStaffDetailInput,
  PosStaffListInput,
  PosStaffSummary,
  PosZReport,
  PosZReportListQuery,
  ShiftRecord,
} from "./staff.types.js";

function requireTerminalContext(authContext: AuthContext): {
  terminalId: string;
  branchId: string;
} {
  const terminalId = authContext.terminalId;
  const branchId = authContext.terminalBranchId;
  if (!terminalId || !branchId) {
    throw new PosStaffError(
      "POS_TERMINAL_REQUIRED",
      "An enrolled POS terminal is required for shift operations.",
      403,
    );
  }
  requirePosBranchAccess(authContext, branchId);
  return { terminalId, branchId };
}

export function assertShiftTerminal(
  shift: ShiftRecord,
  terminal: { terminalId: string; branchId: string },
): void {
  if (
    shift.terminalId !== terminal.terminalId ||
    shift.branchId !== terminal.branchId
  ) {
    throw new AuthError(
      "FORBIDDEN",
      "The open shift belongs to another POS terminal or branch.",
    );
  }
}

export function resolveShiftTransition(
  action: "clock_out" | "break_start" | "break_end",
  status: ShiftRecord["status"],
): {
  from: "open" | "on_break";
  to: "open" | "on_break" | "closed";
} {
  if (action === "break_start" && status === "open") {
    return { from: "open", to: "on_break" };
  }
  if (action === "break_end" && status === "on_break") {
    return { from: "on_break", to: "open" };
  }
  if (action === "clock_out" && status === "open") {
    return { from: "open", to: "closed" };
  }
  throw new PosStaffError(
    "INVALID_SHIFT_ACTION",
    `Cannot perform ${action} while the shift is ${status}.`,
    422,
  );
}

export async function listPosStaff(
  input: PosStaffListInput,
  db: Database = getDb(),
): Promise<PosStaffSummary[]> {
  const tenantId = requirePosTenantId(input.authContext);
  const terminal = requireTerminalContext(input.authContext);
  const staff = await findStaffForBranch(db, {
    tenantId,
    branchId: terminal.branchId,
    query: input.query,
  });
  return staff.map(
    ({ email: _email, phone: _phone, branchId: _branchId, ...item }) => item,
  );
}

export async function getPosStaff(
  input: PosStaffDetailInput,
  db: Database = getDb(),
): Promise<PosStaffDetail> {
  const tenantId = requirePosTenantId(input.authContext);
  const terminal = requireTerminalContext(input.authContext);
  const rows = await findStaffForBranch(db, {
    tenantId,
    branchId: terminal.branchId,
    staffId: input.staffId,
  });
  if (!rows[0]) {
    throw new PosStaffError(
      "STAFF_NOT_FOUND",
      "Staff member was not found in this branch.",
      404,
    );
  }
  return rows[0];
}

export async function getCurrentShift(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<ShiftRecord | null> {
  const tenantId = requirePosTenantId(authContext);
  const terminal = requireTerminalContext(authContext);
  const shift = await findOpenShift(db, {
    tenantId,
    staffId: authContext.userId,
  });
  if (shift) assertShiftTerminal(shift, terminal);
  return shift;
}

export async function clockAction(
  input: ClockInput,
  db: Database = getDb(),
): Promise<ShiftRecord> {
  const tenantId = requirePosTenantId(input.authContext);
  const terminal = requireTerminalContext(input.authContext);

  return db.transaction(async (tx) => {
    if (input.data.action === "clock_in") {
      // Serialize shift creation with terminal disable/rebind/revocation.
      // Without this lock, a request authenticated just before an administrator
      // disables the terminal could create a new open shift after the lifecycle
      // check had already completed.
      const lockedTerminal = await findPosTerminalForShiftUpdate(tx, {
        tenantId,
        terminalId: terminal.terminalId,
      });
      if (
        !lockedTerminal ||
        lockedTerminal.status !== "active" ||
        !lockedTerminal.credentialDigest ||
        lockedTerminal.branchId !== terminal.branchId
      ) {
        throw new AuthError(
          "POS_TERMINAL_DISABLED",
          "The POS terminal session is no longer active.",
        );
      }
      if (
        lockedTerminal.credentialVersion !==
        input.authContext.terminalCredentialVersion
      ) {
        throw new AuthError(
          "POS_TERMINAL_CREDENTIAL_INVALID",
          "The POS terminal credential changed. Sign in with a staff PIN again.",
        );
      }

      const existing = await findOpenShift(tx, {
        tenantId,
        staffId: input.authContext.userId,
      });
      if (existing) {
        throw new PosStaffError(
          "SHIFT_ALREADY_OPEN",
          "This staff member already has an open shift.",
          409,
        );
      }

      const currency = await findActiveBranchCurrency(tx, {
        tenantId,
        branchId: terminal.branchId,
      });
      if (!currency) {
        throw new PosStaffError(
          "BRANCH_NOT_FOUND",
          "The active POS branch was not found.",
          404,
        );
      }

      const shift = await createShiftRecord(tx, {
        tenantId,
        branchId: terminal.branchId,
        terminalId: terminal.terminalId,
        staffId: input.authContext.userId,
        currency,
        openingFloat: input.data.openingFloat ?? "0",
        actorUserId: input.authContext.userId,
      });
      if (!shift) {
        throw new PosStaffError(
          "SHIFT_ALREADY_OPEN",
          "This staff member or terminal already has an open shift.",
          409,
        );
      }
      await writeShiftAudit(tx, input, shift, "pos.shift.clock_in");
      return shift;
    }

    const shift = await findOpenShiftForUpdate(tx, {
      tenantId,
      staffId: input.authContext.userId,
    });
    if (!shift) {
      throw new PosStaffError(
        "SHIFT_NOT_FOUND",
        "No open shift was found for this staff member.",
        404,
      );
    }
    assertShiftTerminal(shift, terminal);

    const transition = resolveShiftTransition(input.data.action, shift.status);
    const updated = await transitionShiftRecord(tx, {
      tenantId,
      shiftId: shift.id,
      ...transition,
      closingFloat: input.data.closingFloat,
      actorUserId: input.authContext.userId,
    });
    if (!updated) {
      throw new PosStaffError(
        "INVALID_SHIFT_ACTION",
        `Cannot perform ${input.data.action} while the shift is ${shift.status}.`,
        422,
      );
    }
    await writeShiftAudit(
      tx,
      input,
      updated,
      `pos.shift.${input.data.action}`,
      { status: shift.status },
    );
    return updated;
  });
}

export async function createHandover(
  input: CreateHandoverInput,
  db: Database = getDb(),
): Promise<HandoverRecord> {
  const tenantId = requirePosTenantId(input.authContext);
  const terminal = requireTerminalContext(input.authContext);

  return db.transaction(async (tx) => {
    const shift = await findOpenShiftForUpdate(tx, {
      tenantId,
      staffId: input.authContext.userId,
    });
    if (!shift) {
      throw new PosStaffError(
        "SHIFT_NOT_FOUND",
        "An open shift is required before handover.",
        404,
      );
    }
    assertShiftTerminal(shift, terminal);
    if (input.data.incomingStaffId === input.authContext.userId) {
      throw new PosStaffError(
        "INVALID_SHIFT_ACTION",
        "Incoming staff must be different from outgoing staff.",
        422,
      );
    }

    const incoming = await findStaffForBranch(tx, {
      tenantId,
      branchId: terminal.branchId,
      staffId: input.data.incomingStaffId,
    });
    if (!incoming[0]) {
      throw new PosStaffError(
        "STAFF_NOT_FOUND",
        "Incoming staff was not found in this branch.",
        404,
      );
    }
    if (incoming[0].currentShiftId) {
      throw new PosStaffError(
        "SHIFT_ALREADY_OPEN",
        "Incoming staff already has an open shift.",
        409,
      );
    }

    const cutoffAt = new Date();
    const snapshot = await calculateHandoverSnapshot(tx, {
      tenantId,
      branchId: terminal.branchId,
      currency: shift.currency,
      startedAt: new Date(shift.startedAt),
      cutoffAt,
      openingFloat: shift.openingFloat,
    });
    const handover = await createHandoverAndZReport(tx, {
      tenantId,
      branchId: terminal.branchId,
      terminalId: terminal.terminalId,
      shift,
      incomingStaffId: input.data.incomingStaffId,
      countedCash: input.data.countedCash,
      notes: input.data.notes,
      cutoffAt,
      actorUserId: input.authContext.userId,
      snapshot,
    });
    if (!handover) {
      throw new PosStaffError(
        "HANDOVER_ALREADY_COMPLETED",
        "This shift has already been handed over.",
        409,
      );
    }

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      branchId: terminal.branchId,
      eventCategory: "pos_shift",
      eventType: "pos.shift.handover_completed",
      entityType: "pos_shift_handover",
      entityId: handover.id,
      after: handover,
      metadata: createPosAuditMetadata(input.authContext, {
        zReportId: handover.zReport.id,
        cutoffAt: handover.cutoffAt,
      }),
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    return handover;
  });
}

export async function listPosZReports(
  authContext: AuthContext,
  query: PosZReportListQuery,
  db: Database = getDb(),
): Promise<PosZReport[]> {
  const tenantId = requirePosTenantId(authContext);
  const terminal = requireTerminalContext(authContext);
  return listZReports(db, {
    tenantId,
    branchId: terminal.branchId,
    limit: query.limit ?? 20,
    offset: query.offset ?? 0,
  });
}

export async function getPosZReport(
  authContext: AuthContext,
  zReportId: string,
  db: Database = getDb(),
): Promise<PosZReport> {
  const tenantId = requirePosTenantId(authContext);
  const terminal = requireTerminalContext(authContext);
  const report = await findZReport(db, {
    tenantId,
    branchId: terminal.branchId,
    zReportId,
  });
  if (!report) {
    throw new PosStaffError(
      "Z_REPORT_NOT_FOUND",
      "Z Report was not found in this branch.",
      404,
    );
  }
  return report;
}

async function writeShiftAudit(
  db: Database,
  input: ClockInput,
  shift: ShiftRecord,
  eventType: string,
  before?: Record<string, unknown>,
): Promise<void> {
  await writeAuditLog(db, {
    actorUserId: input.authContext.userId,
    tenantId: shift.tenantId,
    branchId: shift.branchId,
    eventCategory: "pos_shift",
    eventType,
    entityType: "pos_staff_shift",
    entityId: shift.id,
    before,
    after: shift,
    metadata: createPosAuditMetadata(input.authContext),
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });
}
