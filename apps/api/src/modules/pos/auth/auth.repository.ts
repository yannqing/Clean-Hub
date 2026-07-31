import { and, eq, isNull, ne } from "drizzle-orm";

import {
  authRefreshTokens,
  branches,
  posStaffShifts,
  posTerminalSettings,
  tenants,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type {
  BindPosDeviceRequest,
  PosDevice,
  UpdatePosDeviceRequest,
} from "./auth.types.js";

export type PosDeviceRecord = typeof posTerminalSettings.$inferSelect;

export function toPosDevice(row: PosDeviceRecord): PosDevice {
  return {
    id: row.id,
    deviceId: row.deviceId,
    label: row.label,
    branchId: row.branchId,
    status: row.status,
    credentialVersion: row.credentialVersion,
    credentialIssuedAt: row.credentialIssuedAt?.toISOString() ?? null,
    credentialRotatedAt: row.credentialRotatedAt?.toISOString() ?? null,
    credentialLastUsedAt: row.credentialLastUsedAt?.toISOString() ?? null,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    boundAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findPosDeviceRecord(
  db: Database,
  tenantId: string,
  deviceId: string,
): Promise<PosDeviceRecord | null> {
  const rows = await db
    .select()
    .from(posTerminalSettings)
    .where(
      and(
        eq(posTerminalSettings.tenantId, tenantId),
        eq(posTerminalSettings.deviceId, deviceId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findPosDeviceRecordForUpdate(
  db: Database,
  tenantId: string,
  deviceId: string,
): Promise<PosDeviceRecord | null> {
  const rows = await db
    .select()
    .from(posTerminalSettings)
    .where(
      and(
        eq(posTerminalSettings.tenantId, tenantId),
        eq(posTerminalSettings.deviceId, deviceId),
      ),
    )
    .for("update")
    .limit(1);

  return rows[0] ?? null;
}

export async function findUnclosedPosTerminalShift(
  db: Database,
  input: {
    tenantId: string;
    terminalId: string;
  },
): Promise<{
  id: string;
  branchId: string;
  staffId: string;
  status: "open" | "on_break";
} | null> {
  const rows = await db
    .select({
      id: posStaffShifts.id,
      branchId: posStaffShifts.branchId,
      staffId: posStaffShifts.staffId,
      status: posStaffShifts.status,
    })
    .from(posStaffShifts)
    .where(
      and(
        eq(posStaffShifts.tenantId, input.tenantId),
        eq(posStaffShifts.terminalId, input.terminalId),
        ne(posStaffShifts.status, "closed"),
      ),
    )
    .for("update")
    .limit(1);

  const row = rows[0];
  if (!row || row.status === "closed") return null;
  return {
    id: row.id,
    branchId: row.branchId,
    staffId: row.staffId,
    status: row.status,
  };
}

export async function isActiveTenantBranch(
  db: Database,
  tenantId: string,
  branchId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: branches.id })
    .from(branches)
    .where(
      and(
        eq(branches.id, branchId),
        eq(branches.tenantId, tenantId),
        eq(branches.status, "active"),
        isNull(branches.deletedAt),
      ),
    )
    .limit(1);

  return Boolean(rows[0]);
}

/**
 * Revalidates and locks the enrollment target after the terminal row lock.
 * The key-share lock serializes a new enrollment with branch/tenant status
 * updates, whose lifecycle order is terminal(s) -> branch/tenant.
 */
export async function lockActiveTenantBranch(
  db: Database,
  tenantId: string,
  branchId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: branches.id })
    .from(branches)
    .innerJoin(tenants, eq(tenants.id, branches.tenantId))
    .where(
      and(
        eq(branches.id, branchId),
        eq(branches.tenantId, tenantId),
        eq(branches.status, "active"),
        isNull(branches.deletedAt),
        eq(tenants.status, "active"),
        isNull(tenants.deletedAt),
      ),
    )
    .for("key share")
    .limit(1);

  return Boolean(rows[0]);
}

export async function insertPosDeviceEnrollment(
  db: Database,
  input: {
    tenantId: string;
    actorUserId: string;
    credentialDigest: string;
    data: BindPosDeviceRequest;
  },
): Promise<PosDeviceRecord> {
  const now = new Date();
  const rows = await db
    .insert(posTerminalSettings)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      branchId: input.data.branchId,
      deviceId: input.data.deviceId,
      label: input.data.label,
      status: "active",
      credentialDigest: input.credentialDigest,
      credentialVersion: 1,
      credentialIssuedAt: now,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
      metadata: {
        lastEnrollmentAction: "enrolled",
        lastEnrollmentActorUserId: input.actorUserId,
        lastEnrollmentAt: now.toISOString(),
      },
    })
    .returning();

  return rows[0]!;
}

export async function enrollExistingPosDevice(
  db: Database,
  current: PosDeviceRecord,
  input: {
    actorUserId: string;
    credentialDigest: string;
    data: BindPosDeviceRequest;
  },
): Promise<PosDeviceRecord | null> {
  const now = new Date();
  const rows = await db
    .update(posTerminalSettings)
    .set({
      branchId: input.data.branchId,
      label: input.data.label,
      status: "active",
      credentialDigest: input.credentialDigest,
      credentialVersion: current.credentialVersion + 1,
      credentialIssuedAt: now,
      credentialRotatedAt: current.credentialDigest ? now : null,
      updatedAt: now,
      updatedBy: input.actorUserId,
      version: current.version + 1,
      metadata: {
        ...(current.metadata ?? {}),
        lastEnrollmentAction: current.credentialDigest
          ? "re_enrolled"
          : "enrolled",
        lastEnrollmentActorUserId: input.actorUserId,
        lastEnrollmentAt: now.toISOString(),
      },
    })
    .where(
      and(
        eq(posTerminalSettings.id, current.id),
        eq(posTerminalSettings.version, current.version),
      ),
    )
    .returning();

  return rows[0] ?? null;
}

export async function updatePosDeviceRecord(
  db: Database,
  current: PosDeviceRecord,
  input: {
    actorUserId: string;
    data: UpdatePosDeviceRequest;
  },
): Promise<PosDeviceRecord | null> {
  const now = new Date();
  const branchChanged =
    input.data.branchId !== undefined &&
    input.data.branchId !== current.branchId;
  const statusChanged =
    input.data.status !== undefined && input.data.status !== current.status;
  const securityContextChanged = branchChanged || statusChanged;
  const rows = await db
    .update(posTerminalSettings)
    .set({
      ...(input.data.branchId ? { branchId: input.data.branchId } : {}),
      ...(input.data.label ? { label: input.data.label } : {}),
      ...(input.data.status ? { status: input.data.status } : {}),
      ...(securityContextChanged
        ? { credentialVersion: current.credentialVersion + 1 }
        : {}),
      updatedAt: now,
      updatedBy: input.actorUserId,
      version: current.version + 1,
      metadata: {
        ...(current.metadata ?? {}),
        lastEnrollmentAction:
          statusChanged && input.data.status === "inactive"
            ? "disabled"
            : statusChanged && input.data.status === "active"
              ? "enabled"
              : branchChanged
                ? "rebound"
                : "updated",
        lastEnrollmentActorUserId: input.actorUserId,
        lastEnrollmentAt: now.toISOString(),
        lastEnrollmentReason: input.data.reason,
      },
    })
    .where(
      and(
        eq(posTerminalSettings.id, current.id),
        eq(posTerminalSettings.version, current.version),
      ),
    )
    .returning();

  return rows[0] ?? null;
}

export async function revokePosDeviceRecord(
  db: Database,
  current: PosDeviceRecord,
  input: {
    actorUserId: string;
    reason: string;
  },
): Promise<PosDeviceRecord | null> {
  const now = new Date();
  const rows = await db
    .update(posTerminalSettings)
    .set({
      status: "inactive",
      credentialDigest: null,
      credentialVersion: current.credentialVersion + 1,
      credentialRotatedAt: now,
      credentialLastUsedAt: null,
      updatedAt: now,
      updatedBy: input.actorUserId,
      version: current.version + 1,
      metadata: {
        ...(current.metadata ?? {}),
        lastEnrollmentAction: "revoked",
        lastEnrollmentActorUserId: input.actorUserId,
        lastEnrollmentAt: now.toISOString(),
        lastEnrollmentReason: input.reason,
      },
    })
    .where(
      and(
        eq(posTerminalSettings.id, current.id),
        eq(posTerminalSettings.version, current.version),
      ),
    )
    .returning();

  return rows[0] ?? null;
}

export async function rotatePosDeviceCredentialRecord(
  db: Database,
  current: PosDeviceRecord,
  input: {
    actorUserId: string;
    credentialDigest: string;
    reason: string;
  },
): Promise<PosDeviceRecord | null> {
  const now = new Date();
  const reEnrolling = !current.credentialDigest;
  const rows = await db
    .update(posTerminalSettings)
    .set({
      ...(reEnrolling ? { status: "active" as const } : {}),
      credentialDigest: input.credentialDigest,
      credentialVersion: current.credentialVersion + 1,
      credentialIssuedAt: now,
      credentialRotatedAt: now,
      credentialLastUsedAt: null,
      updatedAt: now,
      updatedBy: input.actorUserId,
      version: current.version + 1,
      metadata: {
        ...(current.metadata ?? {}),
        lastEnrollmentAction: reEnrolling
          ? "credential_re_enrolled"
          : "credential_rotated",
        lastEnrollmentActorUserId: input.actorUserId,
        lastEnrollmentAt: now.toISOString(),
        lastEnrollmentReason: input.reason,
      },
    })
    .where(
      and(
        eq(posTerminalSettings.id, current.id),
        eq(posTerminalSettings.version, current.version),
      ),
    )
    .returning();

  return rows[0] ?? null;
}

export async function revokePosTerminalRefreshTokens(
  db: Database,
  terminalId: string,
): Promise<void> {
  await db
    .update(authRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(authRefreshTokens.terminalId, terminalId),
        isNull(authRefreshTokens.revokedAt),
      ),
    );
}
