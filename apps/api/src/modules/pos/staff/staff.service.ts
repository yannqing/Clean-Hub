import { getDb, type Database } from "@cleanhub/db";

import { AuthError } from "../../auth/auth.errors.js";
import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import {
  authorizePosSensitiveOperation,
  createPosAuditMetadata,
  requirePosBranchAccess,
  requirePosTenantId,
} from "../access-control.helper.js";
import { PosStaffError } from "./staff.errors.js";
import {
  calculateHandoverSnapshot,
  closeCashDrawerSessionRecord,
  closeRegisterSessionRecords,
  createShiftRecord,
  findActiveBranchCurrency,
  findCashDrawerSessionByIdForUpdate,
  findOpenShift,
  findOpenShiftForUpdate,
  findOpenCashDrawerSession,
  findOpenRegisterSession,
  findRegisterSessionByIdForUpdate,
  findRegisterCashSessionTotals,
  findShiftCashMovementByIdempotencyKey,
  findPosTerminalForShiftUpdate,
  findStaffForBranch,
  findZReport,
  insertShiftCashMovement,
  insertCashDrawerSession,
  insertRegisterSession,
  insertRegisterZReport,
  listRegisterCashMovements,
  listZReports,
  transitionShiftRecord,
} from "./staff.repository.js";
import {
  findAuthenticatedTerminalSettings,
  findTenantPosTerminalDefaults,
} from "../terminal-settings/terminal-settings.repository.js";
import type {
  ClockInput,
  CreatePosShiftCashMovementInput,
  PosStaffDetail,
  PosStaffDetailInput,
  PosStaffListInput,
  PosStaffSummary,
  PosCurrentShiftReconciliation,
  PosShiftCashMovement,
  PosZReport,
  PosZReportListQuery,
  PosRegisterState,
  OpenPosRegisterRequest,
  ClosePosRegisterRequest,
  ClosePosRegisterResult,
  ShiftRecord,
} from "./staff.types.js";

async function resolveRegisterConfiguration(
  db: Database,
  authContext: AuthContext,
): Promise<{
  terminal: ReturnType<typeof requireTerminalContext>;
  mode: PosRegisterState["cashHandlingMode"];
  cashTrackingEnabled: boolean;
  requireOpeningFloat: boolean;
  requireClosingCount: boolean;
}> {
  const tenantId = requirePosTenantId(authContext);
  const terminal = requireTerminalContext(authContext);
  const terminalIdentity = {
    tenantId,
    terminalId: terminal.terminalId,
    branchId: terminal.branchId,
    deviceId: authContext.terminalDeviceId!,
    credentialVersion: authContext.terminalCredentialVersion!,
  };
  const [settings, defaults] = await Promise.all([
    findAuthenticatedTerminalSettings(db, terminalIdentity),
    findTenantPosTerminalDefaults(db, tenantId),
  ]);
  if (!settings) {
    throw new PosStaffError(
      "POS_TERMINAL_REQUIRED",
      "Active settings were not found for this POS terminal.",
      403,
    );
  }
  const cashEnabled = settings.paymentMethodsEnabled.includes("cash");
  return {
    terminal,
    mode: !cashEnabled
      ? "none"
      : !defaults.cashTrackingEnabled
        ? "untracked"
        : settings.cashHandlingMode,
    cashTrackingEnabled: defaults.cashTrackingEnabled && cashEnabled,
    requireOpeningFloat: defaults.requireOpeningFloat,
    requireClosingCount: defaults.requireClosingCount,
  };
}

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

export function assertShiftBranch(
  shift: ShiftRecord,
  terminal: { branchId: string },
): void {
  if (shift.branchId !== terminal.branchId) {
    throw new AuthError(
      "FORBIDDEN",
      "The open work shift belongs to another branch.",
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
  if (shift) assertShiftBranch(shift, terminal);
  return shift;
}

function isTrackedCashMode(
  mode: PosRegisterState["cashHandlingMode"],
): mode is "shared_drawer" | "assigned_drawer" | "cash_in_hand" {
  return (
    mode === "shared_drawer" ||
    mode === "assigned_drawer" ||
    mode === "cash_in_hand"
  );
}

async function loadRegisterState(
  db: Database,
  authContext: AuthContext,
  forUpdate = false,
): Promise<PosRegisterState> {
  const tenantId = requirePosTenantId(authContext);
  const configuration = await resolveRegisterConfiguration(db, authContext);
  const registerSession = await findOpenRegisterSession(db, {
    tenantId,
    terminalId: configuration.terminal.terminalId,
    forUpdate,
  });
  const cashSession =
    registerSession && isTrackedCashMode(configuration.mode)
      ? await findOpenCashDrawerSession(db, {
          tenantId,
          registerSessionId: registerSession.id,
          staffId: authContext.userId,
          handlingMode: configuration.mode,
          forUpdate,
        })
      : null;
  return {
    registerSession,
    cashSession,
    cashHandlingMode: configuration.mode,
    cashTrackingEnabled: configuration.cashTrackingEnabled,
    requireOpeningFloat: configuration.requireOpeningFloat,
    requireClosingCount: configuration.requireClosingCount,
  };
}

export async function getCurrentRegisterState(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<PosRegisterState> {
  return loadRegisterState(db, authContext);
}

export async function getCurrentRegisterReconciliation(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<PosCurrentShiftReconciliation | null> {
  const tenantId = requirePosTenantId(authContext);
  const configuration = await resolveRegisterConfiguration(db, authContext);
  const state = await loadRegisterState(db, authContext);
  if (!state.registerSession) return null;
  return calculateHandoverSnapshot(db, {
    tenantId,
    branchId: configuration.terminal.branchId,
    registerSessionId: state.registerSession.id,
    cashDrawerSessionId:
      state.cashHandlingMode === "cash_in_hand"
        ? state.cashSession?.id
        : undefined,
    currency: state.registerSession.currency,
    startedAt: new Date(state.registerSession.openedAt),
    cutoffAt: new Date(),
    openingFloat: state.cashSession?.openingFloat ?? "0",
  });
}

export async function listCurrentRegisterCashMovements(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<{ data: PosShiftCashMovement[] }> {
  const tenantId = requirePosTenantId(authContext);
  const state = await loadRegisterState(db, authContext);
  if (!state.registerSession) return { data: [] };
  return {
    data: await listRegisterCashMovements(db, {
      tenantId,
      registerSessionId: state.registerSession.id,
      cashDrawerSessionId: state.cashSession?.id,
    }),
  };
}

export async function createRegisterCashMovement(
  input: CreatePosShiftCashMovementInput,
  db: Database = getDb(),
): Promise<PosShiftCashMovement> {
  const tenantId = requirePosTenantId(input.authContext);
  const reason = authorizePosSensitiveOperation(
    input.authContext,
    "cash_movement",
    input.data.reason,
  );
  return db.transaction(async (tx) => {
    const configuration = await resolveRegisterConfiguration(
      tx,
      input.authContext,
    );
    const state = await loadRegisterState(tx, input.authContext, true);
    if (!state.registerSession || !state.cashSession) {
      throw new PosStaffError(
        "CASH_SESSION_REQUIRED",
        "Open a tracked cash session before recording cash movements.",
        409,
      );
    }
    const existing = await findShiftCashMovementByIdempotencyKey(tx, {
      tenantId,
      idempotencyKey: input.data.idempotencyKey,
    });
    if (existing) {
      if (
        existing.registerSessionId !== state.registerSession.id ||
        existing.cashDrawerSessionId !== state.cashSession.id ||
        existing.movementType !== input.data.movementType ||
        Number(existing.amount) !== Number(input.data.amount) ||
        existing.reason !== reason
      ) {
        throw new PosStaffError(
          "INVALID_SHIFT_ACTION",
          "The cash movement idempotency key is already used by another operation.",
          409,
        );
      }
      return existing;
    }
    const workShift = await findOpenShift(tx, {
      tenantId,
      staffId: input.authContext.userId,
    });
    const movement = await insertShiftCashMovement(tx, {
      tenantId,
      branchId: configuration.terminal.branchId,
      terminalId: configuration.terminal.terminalId,
      shiftId:
        workShift?.branchId === configuration.terminal.branchId
          ? workShift.id
          : undefined,
      registerSessionId: state.registerSession.id,
      cashDrawerSessionId: state.cashSession.id,
      movementType: input.data.movementType,
      amount: Number(input.data.amount).toFixed(2),
      currency: state.cashSession.currency,
      reason,
      idempotencyKey: input.data.idempotencyKey,
      actorUserId: input.authContext.userId,
    });
    if (!movement) {
      const concurrent = await findShiftCashMovementByIdempotencyKey(tx, {
        tenantId,
        idempotencyKey: input.data.idempotencyKey,
      });
      if (concurrent) return concurrent;
      throw new Error("Cash movement could not be recorded.");
    }
    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      branchId: configuration.terminal.branchId,
      eventCategory: "pos_register",
      eventType: `pos.register.cash_${input.data.movementType}`,
      entityType: "pos_shift_cash_movement",
      entityId: movement.id,
      reason,
      after: movement,
      metadata: createPosAuditMetadata(input.authContext, {
        registerSessionId: state.registerSession.id,
        cashDrawerSessionId: state.cashSession.id,
      }),
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    return movement;
  });
}

export async function openPosRegister(
  authContext: AuthContext,
  data: OpenPosRegisterRequest,
  requestMeta?: AuthRequestMeta,
  db: Database = getDb(),
): Promise<PosRegisterState> {
  const tenantId = requirePosTenantId(authContext);
  return db.transaction(async (tx) => {
    const configuration = await resolveRegisterConfiguration(tx, authContext);
    const currency = await findActiveBranchCurrency(tx, {
      tenantId,
      branchId: configuration.terminal.branchId,
    });
    if (!currency) {
      throw new PosStaffError(
        "BRANCH_NOT_FOUND",
        "The active POS branch was not found.",
        404,
      );
    }
    let registerSession = await findOpenRegisterSession(tx, {
      tenantId,
      terminalId: configuration.terminal.terminalId,
      forUpdate: true,
    });
    registerSession ??= await insertRegisterSession(tx, {
      tenantId,
      branchId: configuration.terminal.branchId,
      terminalId: configuration.terminal.terminalId,
      currency,
      actorUserId: authContext.userId,
    });
    registerSession ??= await findOpenRegisterSession(tx, {
      tenantId,
      terminalId: configuration.terminal.terminalId,
      forUpdate: true,
    });
    if (!registerSession) {
      throw new PosStaffError(
        "REGISTER_ALREADY_OPEN",
        "The register changed while it was being opened.",
        409,
      );
    }

    let cashSession = null;
    if (isTrackedCashMode(configuration.mode)) {
      cashSession = await findOpenCashDrawerSession(tx, {
        tenantId,
        registerSessionId: registerSession.id,
        staffId: authContext.userId,
        handlingMode: configuration.mode,
        forUpdate: true,
      });
      if (!cashSession) {
        if (
          configuration.requireOpeningFloat &&
          data.openingFloat === undefined
        ) {
          throw new PosStaffError(
            "CASH_SESSION_REQUIRED",
            "An opening cash amount is required to start cash tracking.",
            422,
          );
        }
        cashSession = await insertCashDrawerSession(tx, {
          tenantId,
          branchId: configuration.terminal.branchId,
          terminalId: configuration.terminal.terminalId,
          registerSessionId: registerSession.id,
          handlingMode: configuration.mode,
          assignedStaffId:
            configuration.mode === "shared_drawer"
              ? null
              : authContext.userId,
          currency,
          openingFloat: data.openingFloat ?? "0",
          actorUserId: authContext.userId,
        });
        cashSession ??= await findOpenCashDrawerSession(tx, {
          tenantId,
          registerSessionId: registerSession.id,
          staffId: authContext.userId,
          handlingMode: configuration.mode,
          forUpdate: true,
        });
      }
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      branchId: configuration.terminal.branchId,
      eventCategory: "pos_register",
      eventType: "pos.register.opened",
      entityType: "pos_register_session",
      entityId: registerSession.id,
      after: { registerSession, cashSession },
      metadata: createPosAuditMetadata(authContext, {
        cashHandlingMode: configuration.mode,
      }),
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });
    return {
      registerSession,
      cashSession,
      cashHandlingMode: configuration.mode,
      cashTrackingEnabled: configuration.cashTrackingEnabled,
      requireOpeningFloat: configuration.requireOpeningFloat,
      requireClosingCount: configuration.requireClosingCount,
    };
  });
}

export async function closePosRegister(
  authContext: AuthContext,
  data: ClosePosRegisterRequest,
  requestMeta?: AuthRequestMeta,
  db: Database = getDb(),
): Promise<ClosePosRegisterResult> {
  const tenantId = requirePosTenantId(authContext);
  return db.transaction(async (tx) => {
    const configuration = await resolveRegisterConfiguration(tx, authContext);
    const state = await loadRegisterState(tx, authContext, true);
    if (!state.registerSession) {
      throw new PosStaffError(
        "REGISTER_NOT_OPEN",
        "No open register session was found for this terminal.",
        404,
      );
    }
    if (
      state.cashSession?.handlingMode === "assigned_drawer" &&
      state.cashSession.assignedStaffId !== authContext.userId &&
      authContext.role !== "owner" &&
      authContext.role !== "manager"
    ) {
      throw new AuthError(
        "FORBIDDEN",
        "Only the assigned cashier or a manager can close this drawer.",
      );
    }
    if (
      state.cashSession &&
      configuration.requireClosingCount &&
      data.countedCash === undefined
    ) {
      throw new PosStaffError(
        "CASH_SESSION_REQUIRED",
        "A closing cash count is required before closing this register.",
        422,
      );
    }

    if (
      configuration.mode === "cash_in_hand" &&
      state.cashSession
    ) {
      const cutoffAt = new Date();
      const snapshot = await calculateHandoverSnapshot(tx, {
        tenantId,
        branchId: configuration.terminal.branchId,
        registerSessionId: state.registerSession.id,
        cashDrawerSessionId: state.cashSession.id,
        currency: state.cashSession.currency,
        startedAt: new Date(state.cashSession.openedAt),
        cutoffAt,
        openingFloat: state.cashSession.openingFloat,
      });
      const countedCash = data.countedCash ?? snapshot.expectedCash;
      const closedCashSession = await closeCashDrawerSessionRecord(tx, {
        tenantId,
        cashDrawerSessionId: state.cashSession.id,
        actorUserId: authContext.userId,
        expectedCash: snapshot.expectedCash,
        countedCash,
        variance: (
          Number(countedCash) - Number(snapshot.expectedCash)
        ).toFixed(2),
      });
      if (!closedCashSession) {
        throw new PosStaffError(
          "CASH_SESSION_REQUIRED",
          "This personal cash session has already been closed.",
          409,
        );
      }
      await writeAuditLog(tx, {
        actorUserId: authContext.userId,
        tenantId,
        branchId: configuration.terminal.branchId,
        eventCategory: "pos_register",
        eventType: "pos.cash_session.closed",
        entityType: "pos_cash_drawer_session",
        entityId: closedCashSession.id,
        before: state.cashSession,
        after: closedCashSession,
        metadata: createPosAuditMetadata(authContext, {
          registerSessionId: state.registerSession.id,
          cashHandlingMode: configuration.mode,
        }),
        ipAddress: requestMeta?.ipAddress,
        userAgent: requestMeta?.userAgent,
      });
      return {
        registerSession: state.registerSession,
        cashSession: closedCashSession,
        zReport: null,
        registerClosed: false,
      };
    }

    const personalCashTotals =
      configuration.mode === "cash_in_hand"
        ? await findRegisterCashSessionTotals(tx, {
            tenantId,
            registerSessionId: state.registerSession.id,
          })
        : null;
    if (personalCashTotals) {
      if (authContext.role !== "owner" && authContext.role !== "manager") {
        throw new AuthError(
          "FORBIDDEN",
          "Only a manager can close the register after personal cash sessions are closed.",
        );
      }
      if (personalCashTotals.openCount > 0) {
        throw new PosStaffError(
          "CASH_SESSION_REQUIRED",
          "All personal cash sessions must be counted and closed before the register can close.",
          409,
        );
      }
    }
    const cutoffAt = new Date();
    const snapshot = await calculateHandoverSnapshot(tx, {
      tenantId,
      branchId: configuration.terminal.branchId,
      registerSessionId: state.registerSession.id,
      currency: state.registerSession.currency,
      startedAt: new Date(state.registerSession.openedAt),
      cutoffAt,
      openingFloat:
        personalCashTotals?.openingFloat ??
        state.cashSession?.openingFloat ??
        "0",
    });
    const countedCash = state.cashSession
      ? (data.countedCash ?? snapshot.expectedCash)
      : (personalCashTotals?.countedCash ?? snapshot.expectedCash);
    const zReport = await insertRegisterZReport(tx, {
      tenantId,
      branchId: configuration.terminal.branchId,
      terminalId: configuration.terminal.terminalId,
      registerSessionId: state.registerSession.id,
      countedCash,
      cutoffAt,
      actorUserId: authContext.userId,
      snapshot,
    });
    if (!zReport) {
      throw new PosStaffError(
        "REGISTER_NOT_OPEN",
        "This register session has already been closed.",
        409,
      );
    }
    const closed = await closeRegisterSessionRecords(tx, {
      tenantId,
      registerSessionId: state.registerSession.id,
      cashDrawerSessionId: state.cashSession?.id,
      actorUserId: authContext.userId,
      expectedCash: snapshot.expectedCash,
      countedCash,
      variance: zReport.variance,
      notes: data.notes,
    });
    if (!closed) {
      throw new PosStaffError(
        "REGISTER_NOT_OPEN",
        "The register changed while it was being closed.",
        409,
      );
    }
    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      branchId: configuration.terminal.branchId,
      eventCategory: "pos_register",
      eventType: "pos.register.closed",
      entityType: "pos_register_session",
      entityId: closed.registerSession.id,
      before: state,
      after: { ...closed, zReport },
      metadata: createPosAuditMetadata(authContext),
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });
    return { ...closed, zReport, registerClosed: true };
  });
}

export async function ensurePaymentRegisterContext(
  authContext: AuthContext,
  paymentMethod: "cash" | "card" | "app",
  db: Database,
  requested?: {
    registerSessionId?: string;
    cashDrawerSessionId?: string;
  },
): Promise<{
  registerSessionId: string;
  cashDrawerSessionId: string | null;
  shiftId: string | null;
}> {
  const tenantId = requirePosTenantId(authContext);
  const configuration = await resolveRegisterConfiguration(db, authContext);
  let register = requested?.registerSessionId
    ? await findRegisterSessionByIdForUpdate(db, {
        tenantId,
        registerSessionId: requested.registerSessionId,
      })
    : await findOpenRegisterSession(db, {
        tenantId,
        terminalId: configuration.terminal.terminalId,
        forUpdate: true,
      });
  if (
    register &&
    (register.terminalId !== configuration.terminal.terminalId ||
      register.branchId !== configuration.terminal.branchId ||
      register.status !== "open")
  ) {
    throw new PosStaffError(
      "REGISTER_NOT_OPEN",
      "The requested register session is not open on this terminal.",
      409,
    );
  }
  if (requested?.registerSessionId && !register) {
    throw new PosStaffError(
      "REGISTER_NOT_OPEN",
      "The requested register session was not found.",
      409,
    );
  }
  if (!register) {
    const currency = await findActiveBranchCurrency(db, {
      tenantId,
      branchId: configuration.terminal.branchId,
    });
    if (!currency) {
      throw new PosStaffError(
        "BRANCH_NOT_FOUND",
        "The active POS branch was not found.",
        404,
      );
    }
    register = await insertRegisterSession(db, {
      tenantId,
      branchId: configuration.terminal.branchId,
      terminalId: configuration.terminal.terminalId,
      currency,
      actorUserId: authContext.userId,
    });
    register ??= await findOpenRegisterSession(db, {
      tenantId,
      terminalId: configuration.terminal.terminalId,
      forUpdate: true,
    });
  }
  if (!register) {
    throw new PosStaffError(
      "REGISTER_NOT_OPEN",
      "A register session could not be opened for this payment.",
      409,
    );
  }
  let cashSession = null;
  if (paymentMethod === "cash") {
    if (configuration.mode === "none") {
      throw new PosStaffError(
        "CASH_HANDLING_DISABLED",
        "Cash payments are disabled on this terminal.",
        422,
      );
    }
    if (isTrackedCashMode(configuration.mode)) {
      cashSession = requested?.cashDrawerSessionId
        ? await findCashDrawerSessionByIdForUpdate(db, {
            tenantId,
            cashDrawerSessionId: requested.cashDrawerSessionId,
          })
        : await findOpenCashDrawerSession(db, {
            tenantId,
            registerSessionId: register.id,
            staffId: authContext.userId,
            handlingMode: configuration.mode,
            forUpdate: true,
          });
      if (requested?.cashDrawerSessionId && !cashSession) {
        throw new PosStaffError(
          "CASH_SESSION_REQUIRED",
          "The requested cash session was not found.",
          409,
        );
      }
      if (
        cashSession &&
        (cashSession.registerSessionId !== register.id ||
          cashSession.status !== "open" ||
          cashSession.handlingMode !== configuration.mode)
      ) {
        throw new PosStaffError(
          "CASH_SESSION_REQUIRED",
          "The requested cash session is not open for this register.",
          409,
        );
      }
      if (!cashSession && configuration.requireOpeningFloat) {
        throw new PosStaffError(
          "CASH_SESSION_REQUIRED",
          "Open cash tracking and enter the starting cash before accepting cash.",
          409,
        );
      }
      if (!cashSession) {
        cashSession = await insertCashDrawerSession(db, {
          tenantId,
          branchId: configuration.terminal.branchId,
          terminalId: configuration.terminal.terminalId,
          registerSessionId: register.id,
          handlingMode: configuration.mode,
          assignedStaffId:
            configuration.mode === "shared_drawer"
              ? null
              : authContext.userId,
          currency: register.currency,
          openingFloat: "0",
          actorUserId: authContext.userId,
        });
      }
      if (
        cashSession?.handlingMode === "assigned_drawer" &&
        cashSession.assignedStaffId !== authContext.userId &&
        authContext.role !== "owner" &&
        authContext.role !== "manager"
      ) {
        throw new AuthError(
          "FORBIDDEN",
          "This cash drawer is assigned to another cashier.",
        );
      }
    }
  }
  const workShift = await findOpenShift(db, {
    tenantId,
    staffId: authContext.userId,
  });
  return {
    registerSessionId: register.id,
    cashDrawerSessionId: cashSession?.id ?? null,
    shiftId:
      workShift?.branchId === configuration.terminal.branchId
        ? workShift.id
        : null,
  };
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
        openingFloat: "0",
        actorUserId: input.authContext.userId,
      });
      if (!shift) {
        throw new PosStaffError(
          "SHIFT_ALREADY_OPEN",
          "This staff member already has an open work shift.",
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
    assertShiftBranch(shift, terminal);

    const transition = resolveShiftTransition(input.data.action, shift.status);
    const updated = await transitionShiftRecord(tx, {
      tenantId,
      shiftId: shift.id,
      ...transition,
      closingFloat: "0",
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
