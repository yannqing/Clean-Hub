import { getDb, type Database } from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import {
  buildPosPinLockKeys,
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
import { PosTerminalAuthError } from "./auth.errors.js";
import {
  enrollExistingPosDevice,
  findPosDeviceRecord,
  insertPosDeviceEnrollment,
  isActiveTenantBranch,
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

function credentialCookie(credential: string): string[] {
  return [createTerminalCredentialCookieHeader(credential)];
}

export async function bindPosDevice(
  input: BindPosDeviceInput,
  db: Database = getDb(),
): Promise<PosDeviceMutationResult> {
  const tenantId = requirePosTenantId(input.authContext);
  requirePosRole(input.authContext, ["owner", "manager"]);
  requirePosBranchAccess(input.authContext, input.data.branchId);
  await requireActiveBranch(db, tenantId, input.data.branchId);

  const credential = generateTerminalCredential();
  const credentialDigest = hashTerminalCredential(credential);

  const device = await db.transaction(async (tx) => {
    const existing = await findPosDeviceRecord(
      tx,
      tenantId,
      input.data.deviceId,
    );

    if (existing?.credentialDigest) {
      throw new PosTerminalAuthError(
        "POS_TERMINAL_ALREADY_ENROLLED",
        "The terminal is already enrolled. Rotate its credential instead.",
        409,
      );
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

  return { device, setCookieHeaders: credentialCookie(credential) };
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
    const saved = await updatePosDeviceRecord(tx, current, {
      actorUserId: input.authContext.userId,
      data: input.data,
    });
    if (!saved) throw versionConflict();

    const before = toPosDevice(current);
    const after = toPosDevice(saved);
    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      branchId: after.branchId,
      eventCategory: "pos_terminal_security",
      eventType:
        input.data.status === "inactive"
          ? "pos_terminal.disabled"
          : input.data.status === "active"
            ? "pos_terminal.enabled"
            : input.data.branchId
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

export async function rotatePosDeviceCredential(
  input: RotatePosDeviceCredentialInput,
  db: Database = getDb(),
): Promise<PosDeviceMutationResult> {
  const tenantId = requirePosTenantId(input.authContext);
  requirePosRole(input.authContext, ["owner", "manager"]);
  const current = await requireDevice(db, tenantId, input.deviceId);
  requirePosBranchAccess(input.authContext, current.branchId);

  const credential = generateTerminalCredential();
  const credentialDigest = hashTerminalCredential(credential);
  const device = await db.transaction(async (tx) => {
    const saved = await rotatePosDeviceCredentialRecord(tx, current, {
      actorUserId: input.authContext.userId,
      credentialDigest,
      reason: input.data.reason,
    });
    if (!saved) throw versionConflict();

    const before = toPosDevice(current);
    const after = toPosDevice(saved);
    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      branchId: after.branchId,
      eventCategory: "pos_terminal_security",
      eventType: "pos_terminal.credential_rotated",
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

  return { device, setCookieHeaders: credentialCookie(credential) };
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
    lockedByStaffId:
      status === "inactive" ? input.authContext.userId : null,
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
