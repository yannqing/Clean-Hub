import { getDb, type Database } from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import { AuthError } from "../../auth/auth.errors.js";
import type { AuthContext } from "../../auth/auth.types.js";
import {
  buildPosPinLockKeys,
  createClearTerminalCredentialCookieHeader,
  createTerminalCredentialCookieHeader,
  generateTerminalCredential,
  hashTerminalCredential,
} from "../../auth/pos-terminal-credential.js";
import { clearLoginLockout } from "../../auth/login-lockout.helper.js";
import {
  requirePosBranchAccess,
  requirePosRole,
  requirePosTenantId,
} from "../access-control.helper.js";
import { securityForceClosePosTerminalShifts } from "../terminal-lifecycle/terminal-lifecycle.repository.js";
import { PosTerminalAuthError } from "./auth.errors.js";
import {
  enrollExistingPosDevice,
  findPosDeviceRecord,
  findPosDeviceRecordForUpdate,
  findUnclosedPosTerminalShift,
  insertPosDeviceEnrollment,
  isActiveTenantBranch,
  lockActiveTenantBranch,
  revokePosDeviceRecord,
  revokePosTerminalRefreshTokens,
  rotatePosDeviceCredentialRecord,
  toPosDevice,
  updatePosDeviceRecord,
  type PosDeviceRecord,
} from "./auth.repository.js";
import type {
  BindPosDeviceInput,
  GetPosDeviceInput,
  PosDevice,
  PosDeviceMutationResult,
  PosTerminalState,
  RevokePosDeviceInput,
  RotatePosDeviceCredentialInput,
  SetTerminalLockInput,
  UpdatePosDeviceInput,
} from "./auth.types.js";

function versionConflict(): PosTerminalAuthError {
  return new PosTerminalAuthError(
    "POS_TERMINAL_VERSION_CONFLICT",
    "The terminal changed during this request. Refresh and try again.",
    409,
  );
}

export function isPosDeviceSecurityContextChanged(
  current: Pick<PosDeviceRecord, "branchId" | "status">,
  data: Pick<UpdatePosDeviceInput["data"], "branchId" | "status">,
): boolean {
  return (
    (data.branchId !== undefined && data.branchId !== current.branchId) ||
    (data.status !== undefined && data.status !== current.status)
  );
}

export function requiresClosedPosTerminalShift(
  current: Pick<PosDeviceRecord, "branchId" | "status">,
  data: Pick<UpdatePosDeviceInput["data"], "branchId" | "status">,
): boolean {
  return data.branchId !== undefined && data.branchId !== current.branchId;
}

async function assertNoUnclosedTerminalShift(
  db: Database,
  input: {
    tenantId: string;
    terminalId: string;
  },
): Promise<void> {
  const shift = await findUnclosedPosTerminalShift(db, input);
  if (!shift) return;

  throw new PosTerminalAuthError(
    "POS_TERMINAL_SHIFT_OPEN",
    `The POS terminal has an unfinished ${shift.status} shift. Close the shift before moving the terminal to another branch.`,
    409,
  );
}

async function requireActiveBranch(
  db: Database,
  tenantId: string,
  branchId: string,
): Promise<void> {
  if (!(await isActiveTenantBranch(db, tenantId, branchId))) {
    throw new PosTerminalAuthError(
      "POS_TERMINAL_BRANCH_INACTIVE",
      "The terminal branch does not exist or is inactive.",
      403,
    );
  }
}

async function requireDevice(
  db: Database,
  tenantId: string,
  deviceId: string,
): Promise<PosDeviceRecord> {
  const device = await findPosDeviceRecord(db, tenantId, deviceId);
  if (!device) {
    throw new PosTerminalAuthError(
      "POS_TERMINAL_NOT_FOUND",
      "The POS terminal is not enrolled.",
    );
  }
  return device;
}

function credentialCookie(
  credential: string,
  cookieSecure?: boolean,
): string[] {
  return [
    createTerminalCredentialCookieHeader(credential, {
      secure: cookieSecure,
    }),
  ];
}

function requireEnrollmentBranchAccess(
  authContext: AuthContext,
  branchId: string,
): void {
  requirePosBranchAccess(authContext, branchId);

  if (authContext.role !== "manager") {
    return;
  }

  const assignedBranchIds = [...new Set(authContext.branchIds)];
  if (assignedBranchIds.length !== 1 || assignedBranchIds[0] !== branchId) {
    throw new AuthError(
      "FORBIDDEN",
      "A Manager may enroll a POS terminal only for their single assigned branch.",
    );
  }
}

export async function bindPosDevice(
  input: BindPosDeviceInput,
  db: Database = getDb(),
): Promise<PosDeviceMutationResult> {
  const tenantId = requirePosTenantId(input.authContext);
  requirePosRole(input.authContext, ["owner", "manager"]);
  requireEnrollmentBranchAccess(input.authContext, input.data.branchId);
  await requireActiveBranch(db, tenantId, input.data.branchId);

  const credential = generateTerminalCredential();
  const credentialDigest = hashTerminalCredential(credential);

  const device = await db.transaction(async (tx) => {
    const existing = await findPosDeviceRecordForUpdate(
      tx,
      tenantId,
      input.data.deviceId,
    );

    if (existing) {
      requirePosBranchAccess(input.authContext, existing.branchId);
    }

    if (!(await lockActiveTenantBranch(tx, tenantId, input.data.branchId))) {
      throw new PosTerminalAuthError(
        "POS_TERMINAL_BRANCH_INACTIVE",
        "The terminal branch does not exist or is inactive.",
        403,
      );
    }

    if (existing?.credentialDigest) {
      throw new PosTerminalAuthError(
        "POS_TERMINAL_ALREADY_ENROLLED",
        "The terminal is already enrolled. Rotate its credential instead.",
        409,
      );
    }

    if (
      existing &&
      requiresClosedPosTerminalShift(existing, {
        branchId: input.data.branchId,
        status: "active",
      })
    ) {
      await assertNoUnclosedTerminalShift(tx, {
        tenantId,
        terminalId: existing.id,
      });
    }

    const saved = existing
      ? await enrollExistingPosDevice(tx, existing, {
          actorUserId: input.authContext.userId,
          credentialDigest,
          data: input.data,
        })
      : await insertPosDeviceEnrollment(tx, {
          tenantId,
          actorUserId: input.authContext.userId,
          credentialDigest,
          data: input.data,
        });

    if (!saved) throw versionConflict();
    const summary = toPosDevice(saved);

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      branchId: summary.branchId,
      eventCategory: "pos_terminal_security",
      eventType: "pos_terminal.enrolled",
      entityType: "pos_terminal_settings",
      entityId: summary.id,
      after: { ...summary },
      metadata: {
        terminalId: summary.id,
        terminalDeviceId: summary.deviceId,
        credentialVersion: summary.credentialVersion,
      },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return summary;
  });

  return {
    device,
    setCookieHeaders: credentialCookie(credential, input.cookieSecure),
  };
}

export async function getPosDevice(
  input: GetPosDeviceInput,
  db: Database = getDb(),
): Promise<PosDevice> {
  const tenantId = requirePosTenantId(input.authContext);
  const current = await requireDevice(db, tenantId, input.deviceId);
  requirePosBranchAccess(input.authContext, current.branchId);
  return toPosDevice(current);
}

export async function updatePosDevice(
  input: UpdatePosDeviceInput,
  db: Database = getDb(),
): Promise<PosDevice> {
  const tenantId = requirePosTenantId(input.authContext);
  requirePosRole(input.authContext, ["owner", "manager"]);
  const current = await requireDevice(db, tenantId, input.deviceId);
  requirePosBranchAccess(input.authContext, current.branchId);

  if (input.data.branchId) {
    requirePosBranchAccess(input.authContext, input.data.branchId);
    await requireActiveBranch(db, tenantId, input.data.branchId);
  }

  return db.transaction(async (tx) => {
    const lockedCurrent = await findPosDeviceRecordForUpdate(
      tx,
      tenantId,
      input.deviceId,
    );
    if (!lockedCurrent || lockedCurrent.version !== current.version) {
      throw versionConflict();
    }

    if (
      input.data.status === "active" &&
      lockedCurrent.status !== "active" &&
      !lockedCurrent.credentialDigest
    ) {
      throw new PosTerminalAuthError(
        "POS_TERMINAL_CREDENTIAL_REVOKED",
        "The terminal credential was revoked. Enroll this device again before enabling it.",
        409,
      );
    }

    const securityContextChanged = isPosDeviceSecurityContextChanged(
      lockedCurrent,
      input.data,
    );
    const branchChanged = requiresClosedPosTerminalShift(
      lockedCurrent,
      input.data,
    );
    if (branchChanged) {
      await assertNoUnclosedTerminalShift(tx, {
        tenantId,
        terminalId: lockedCurrent.id,
      });
    }

    if (
      (branchChanged || input.data.status === "active") &&
      !(await lockActiveTenantBranch(
        tx,
        tenantId,
        input.data.branchId ?? lockedCurrent.branchId,
      ))
    ) {
      throw new PosTerminalAuthError(
        "POS_TERMINAL_BRANCH_INACTIVE",
        "The terminal branch does not exist or is inactive.",
        403,
      );
    }

    if (!branchChanged && input.data.status === "inactive") {
      await securityForceClosePosTerminalShifts(tx, {
        tenantId,
        terminalIds: [lockedCurrent.id],
        actorUserId: input.authContext.userId,
        reason: input.data.reason,
        metadata: {
          securityTrigger: "terminal_disabled",
          terminalId: lockedCurrent.id,
          terminalDeviceId: lockedCurrent.deviceId,
        },
        requestMeta: input.requestMeta,
      });
    }

    const saved = await updatePosDeviceRecord(tx, lockedCurrent, {
      actorUserId: input.authContext.userId,
      data: input.data,
    });
    if (!saved) throw versionConflict();

    const before = toPosDevice(lockedCurrent);
    const after = toPosDevice(saved);
    if (securityContextChanged) {
      await revokePosTerminalRefreshTokens(tx, tenantId, after.id);
    }
    const statusChanged = lockedCurrent.status !== saved.status;
    const savedBranchChanged = lockedCurrent.branchId !== saved.branchId;
    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      branchId: after.branchId,
      eventCategory: "pos_terminal_security",
      eventType:
        statusChanged && saved.status === "inactive"
          ? "pos_terminal.disabled"
          : statusChanged && saved.status === "active"
            ? "pos_terminal.enabled"
            : savedBranchChanged
              ? "pos_terminal.rebound"
              : "pos_terminal.updated",
      entityType: "pos_terminal_settings",
      entityId: after.id,
      reason: input.data.reason,
      before: { ...before },
      after: { ...after },
      metadata: {
        terminalId: after.id,
        terminalDeviceId: after.deviceId,
      },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    return after;
  });
}

export async function revokePosDevice(
  input: RevokePosDeviceInput,
  db: Database = getDb(),
): Promise<PosDeviceMutationResult> {
  const tenantId = requirePosTenantId(input.authContext);
  requirePosRole(input.authContext, ["owner", "manager"]);
  const current = await requireDevice(db, tenantId, input.deviceId);
  requirePosBranchAccess(input.authContext, current.branchId);

  const device = await db.transaction(async (tx) => {
    const lockedCurrent = await findPosDeviceRecordForUpdate(
      tx,
      tenantId,
      input.deviceId,
    );
    if (!lockedCurrent || lockedCurrent.version !== current.version) {
      throw versionConflict();
    }

    await securityForceClosePosTerminalShifts(tx, {
      tenantId,
      terminalIds: [lockedCurrent.id],
      actorUserId: input.authContext.userId,
      reason: input.data.reason,
      metadata: {
        securityTrigger: "terminal_credential_revoked",
        terminalId: lockedCurrent.id,
        terminalDeviceId: lockedCurrent.deviceId,
      },
      requestMeta: input.requestMeta,
    });

    const saved = await revokePosDeviceRecord(tx, lockedCurrent, {
      actorUserId: input.authContext.userId,
      reason: input.data.reason,
    });
    if (!saved) throw versionConflict();

    const before = toPosDevice(lockedCurrent);
    const after = toPosDevice(saved);
    await revokePosTerminalRefreshTokens(tx, tenantId, after.id);
    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      branchId: before.branchId,
      eventCategory: "pos_terminal_security",
      eventType: "pos_terminal.revoked",
      entityType: "pos_terminal_settings",
      entityId: after.id,
      reason: input.data.reason,
      before: { ...before },
      after: { ...after },
      metadata: {
        terminalId: after.id,
        terminalDeviceId: after.deviceId,
        credentialVersion: after.credentialVersion,
      },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    return after;
  });

  return {
    device,
    setCookieHeaders: [
      createClearTerminalCredentialCookieHeader({
        secure: input.cookieSecure,
      }),
    ],
  };
}

export async function rotatePosDeviceCredential(
  input: RotatePosDeviceCredentialInput,
  db: Database = getDb(),
): Promise<PosDeviceMutationResult> {
  const tenantId = requirePosTenantId(input.authContext);
  requirePosRole(input.authContext, ["owner", "manager"]);
  const current = await requireDevice(db, tenantId, input.deviceId);
  requirePosBranchAccess(input.authContext, current.branchId);
  await requireActiveBranch(db, tenantId, current.branchId);

  const credential = generateTerminalCredential();
  const credentialDigest = hashTerminalCredential(credential);
  const reEnrolling = !current.credentialDigest;
  const device = await db.transaction(async (tx) => {
    const lockedCurrent = await findPosDeviceRecordForUpdate(
      tx,
      tenantId,
      input.deviceId,
    );
    if (!lockedCurrent || lockedCurrent.version !== current.version) {
      throw versionConflict();
    }

    // Revalidate and lock the branch + tenant only after locking the terminal.
    // This keeps the global terminal -> branch/tenant lock order and prevents
    // a credential rotation from committing after either resource was
    // concurrently disabled.
    if (!(await lockActiveTenantBranch(tx, tenantId, lockedCurrent.branchId))) {
      throw new PosTerminalAuthError(
        "POS_TERMINAL_BRANCH_INACTIVE",
        "The terminal branch does not exist or is inactive.",
        403,
      );
    }

    const saved = await rotatePosDeviceCredentialRecord(tx, lockedCurrent, {
      actorUserId: input.authContext.userId,
      credentialDigest,
      reason: input.data.reason,
    });
    if (!saved) throw versionConflict();

    const before = toPosDevice(lockedCurrent);
    const after = toPosDevice(saved);
    await revokePosTerminalRefreshTokens(tx, tenantId, after.id);
    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      branchId: after.branchId,
      eventCategory: "pos_terminal_security",
      eventType: reEnrolling
        ? "pos_terminal.credential_re_enrolled"
        : "pos_terminal.credential_rotated",
      entityType: "pos_terminal_settings",
      entityId: after.id,
      reason: input.data.reason,
      before: { ...before },
      after: { ...after },
      metadata: {
        terminalId: after.id,
        terminalDeviceId: after.deviceId,
        credentialVersion: after.credentialVersion,
      },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    return after;
  });

  return {
    device,
    setCookieHeaders: credentialCookie(credential, input.cookieSecure),
  };
}

export async function setTerminalLock(
  input: SetTerminalLockInput,
  db: Database = getDb(),
): Promise<PosTerminalState> {
  const status = input.data.lockState === "locked" ? "inactive" : "active";
  const device = await updatePosDevice(
    {
      authContext: input.authContext,
      requestMeta: input.requestMeta,
      deviceId: input.deviceId,
      data: { status, reason: input.data.reason },
    },
    db,
  );

  if (status === "active") {
    const terminalLockKey = buildPosPinLockKeys({
      tenantId: requirePosTenantId(input.authContext),
      terminalId: device.id,
    })[0];
    if (terminalLockKey) await clearLoginLockout(db, terminalLockKey);
  }

  return {
    deviceId: device.deviceId,
    lockState: status === "inactive" ? "locked" : "unlocked",
    lockedAt: status === "inactive" ? device.updatedAt : null,
    lockedByStaffId: status === "inactive" ? input.authContext.userId : null,
  };
}

export async function getTerminalState(
  input: GetPosDeviceInput,
  db: Database = getDb(),
): Promise<PosTerminalState> {
  const device = await getPosDevice(input, db);
  return {
    deviceId: device.deviceId,
    lockState: device.status === "inactive" ? "locked" : "unlocked",
    lockedAt: device.status === "inactive" ? device.updatedAt : null,
    lockedByStaffId: null,
  };
}
