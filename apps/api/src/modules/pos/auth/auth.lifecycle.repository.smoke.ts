import assert from "node:assert/strict";

import "../../../config/env.js";

import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  auditLogs,
  authRefreshTokens,
  branches,
  closeDbConnection,
  getDb,
  posStaffShifts,
  posTerminalSettings,
  tenants,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type { AuthContext } from "../../auth/auth.types.js";
import { PosTerminalAuthError } from "./auth.errors.js";
import {
  bindPosDevice,
  revokePosDevice,
  rotatePosDeviceCredential,
  updatePosDevice,
} from "./auth.service.js";

async function insertTerminalRefreshToken(input: {
  terminalId: string;
  tenantId: string;
  userId: string;
}): Promise<string> {
  const db = getDb();
  const id = createId();
  await db.insert(authRefreshTokens).values({
    id,
    userId: input.userId,
    tenantId: input.tenantId,
    terminalId: input.terminalId,
    tokenHash: `pos-terminal-lifecycle-${createId()}`,
    familyId: createId(),
    expiresAt: new Date(Date.now() + 60_000),
  });
  return id;
}

async function assertRefreshTokenRevoked(tokenId: string): Promise<void> {
  const rows = await getDb()
    .select({ revokedAt: authRefreshTokens.revokedAt })
    .from(authRefreshTokens)
    .where(eq(authRefreshTokens.id, tokenId))
    .limit(1);
  assert.ok(rows[0]?.revokedAt, "terminal refresh token must be revoked");
}

export async function runPosTerminalLifecycleRepositorySmoke(): Promise<void> {
  const db = getDb();
  const tenantRows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(and(eq(tenants.status, "active"), isNull(tenants.deletedAt)))
    .limit(1);
  const tenantId = tenantRows[0]?.id;
  assert.ok(tenantId, "terminal lifecycle smoke requires an active tenant");

  const userId = createId();
  const branchAId = createId();
  const branchBId = createId();
  const terminalId = createId();
  const deviceId = `pos-security-smoke-${createId()}`;
  const enrollmentDeviceId = `pos-runtime-smoke-${createId()}`;
  const shiftId = createId();
  const revokeShiftId = createId();
  const refreshTokenIds: string[] = [];
  let enrollmentTerminalId: string | null = null;

  const authContext: AuthContext = {
    userId,
    displayName: "POS terminal lifecycle smoke",
    tenantId,
    branchIds: [],
    role: "owner",
    roles: ["owner"],
    permissions: [],
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  };

  try {
    await db.insert(users).values({
      id: userId,
      tenantId,
      userType: "tenant",
      passwordHash: "not-used-by-smoke",
      pinHash: "not-used-by-smoke",
      status: "active",
    });
    await db.insert(branches).values([
      {
        id: branchAId,
        tenantId,
        name: "POS security smoke branch A",
        status: "active",
        createdBy: userId,
        updatedBy: userId,
      },
      {
        id: branchBId,
        tenantId,
        name: "POS security smoke branch B",
        status: "active",
        createdBy: userId,
        updatedBy: userId,
      },
    ]);

    const enrollment = await bindPosDevice(
      {
        authContext,
        cookieSecure: true,
        data: {
          deviceId: enrollmentDeviceId,
          branchId: branchAId,
          label: "POS runtime metadata smoke",
          deviceType: "tablet",
          platform: "ios",
          platformVersion: "18.0",
          appVersion: "0.1.0-smoke",
        },
      },
      db,
    );
    enrollmentTerminalId = enrollment.device.id;
    const enrollmentRows = await db
      .select({
        deviceType: posTerminalSettings.deviceType,
        platform: posTerminalSettings.platform,
        platformVersion: posTerminalSettings.platformVersion,
        appVersion: posTerminalSettings.appVersion,
        lastSeenAt: posTerminalSettings.lastSeenAt,
        syncStatus: posTerminalSettings.syncStatus,
        lastSyncedAt: posTerminalSettings.lastSyncedAt,
      })
      .from(posTerminalSettings)
      .where(eq(posTerminalSettings.id, enrollmentTerminalId))
      .limit(1);
    assert.equal(enrollmentRows[0]?.deviceType, "tablet");
    assert.equal(enrollmentRows[0]?.platform, "ios");
    assert.equal(enrollmentRows[0]?.platformVersion, "18.0");
    assert.equal(enrollmentRows[0]?.appVersion, "0.1.0-smoke");
    assert.equal(enrollmentRows[0]?.syncStatus, "synced");
    assert.ok(enrollmentRows[0]?.lastSeenAt);
    assert.ok(enrollmentRows[0]?.lastSyncedAt);

    await db.insert(posTerminalSettings).values({
      id: terminalId,
      tenantId,
      branchId: branchAId,
      deviceId,
      label: "POS lifecycle smoke",
      status: "active",
      credentialDigest: "pos-lifecycle-smoke-credential-digest",
      credentialVersion: 7,
      credentialIssuedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    });
    await db.insert(posStaffShifts).values({
      id: shiftId,
      tenantId,
      branchId: branchAId,
      terminalId,
      staffId: userId,
      status: "open",
      openingFloat: "0",
      createdBy: userId,
      updatedBy: userId,
    });

    await assert.rejects(
      () =>
        updatePosDevice(
          {
            authContext,
            deviceId,
            data: {
              branchId: branchBId,
              reason: "Smoke must close shift before moving",
            },
          },
          db,
        ),
      (error: unknown) =>
        error instanceof PosTerminalAuthError &&
        error.code === "POS_TERMINAL_SHIFT_OPEN" &&
        error.status === 409,
    );

    const unchangedRows = await db
      .select({
        branchId: posTerminalSettings.branchId,
        status: posTerminalSettings.status,
        credentialVersion: posTerminalSettings.credentialVersion,
      })
      .from(posTerminalSettings)
      .where(eq(posTerminalSettings.id, terminalId))
      .limit(1);
    assert.deepEqual(unchangedRows[0], {
      branchId: branchAId,
      status: "active",
      credentialVersion: 7,
    });

    const disableTokenId = await insertTerminalRefreshToken({
      terminalId,
      tenantId,
      userId,
    });
    refreshTokenIds.push(disableTokenId);
    const disabled = await updatePosDevice(
      {
        authContext,
        deviceId,
        data: { status: "inactive", reason: "Smoke disable" },
      },
      db,
    );
    assert.equal(disabled.credentialVersion, 8);
    assert.equal(disabled.status, "inactive");
    await assertRefreshTokenRevoked(disableTokenId);

    const disabledShiftRows = await db
      .select({
        status: posStaffShifts.status,
        endedAt: posStaffShifts.endedAt,
        closingFloat: posStaffShifts.closingFloat,
        version: posStaffShifts.version,
      })
      .from(posStaffShifts)
      .where(eq(posStaffShifts.id, shiftId))
      .limit(1);
    assert.equal(disabledShiftRows[0]?.status, "closed");
    assert.ok(disabledShiftRows[0]?.endedAt);
    assert.equal(disabledShiftRows[0]?.closingFloat, null);
    assert.equal(disabledShiftRows[0]?.version, 2);

    const disableShiftAuditRows = await db
      .select({ metadata: auditLogs.metadata })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityId, shiftId),
          eq(auditLogs.eventType, "pos.shift.security_forced_closed"),
        ),
      );
    assert.equal(disableShiftAuditRows.length, 1);
    assert.equal(
      disableShiftAuditRows[0]?.metadata?.cashReconciliationRequired,
      true,
    );
    assert.equal(
      disableShiftAuditRows[0]?.metadata?.securityTrigger,
      "terminal_disabled",
    );

    const enableTokenId = await insertTerminalRefreshToken({
      terminalId,
      tenantId,
      userId,
    });
    refreshTokenIds.push(enableTokenId);
    const enabled = await updatePosDevice(
      {
        authContext,
        deviceId,
        data: { status: "active", reason: "Smoke enable" },
      },
      db,
    );
    assert.equal(enabled.credentialVersion, 9);
    assert.equal(enabled.status, "active");
    await assertRefreshTokenRevoked(enableTokenId);

    const moveTokenId = await insertTerminalRefreshToken({
      terminalId,
      tenantId,
      userId,
    });
    refreshTokenIds.push(moveTokenId);
    const moved = await updatePosDevice(
      {
        authContext,
        deviceId,
        data: { branchId: branchBId, reason: "Smoke move" },
      },
      db,
    );
    assert.equal(moved.credentialVersion, 10);
    assert.equal(moved.branchId, branchBId);
    await assertRefreshTokenRevoked(moveTokenId);

    const moveBackTokenId = await insertTerminalRefreshToken({
      terminalId,
      tenantId,
      userId,
    });
    refreshTokenIds.push(moveBackTokenId);
    const movedBack = await updatePosDevice(
      {
        authContext,
        deviceId,
        data: { branchId: branchAId, reason: "Smoke move back" },
      },
      db,
    );
    assert.equal(movedBack.credentialVersion, 11);
    assert.notEqual(
      movedBack.credentialVersion,
      7,
      "moving back must not revive access tokens from the original branch",
    );
    await assertRefreshTokenRevoked(moveBackTokenId);

    const labelOnlyTokenId = await insertTerminalRefreshToken({
      terminalId,
      tenantId,
      userId,
    });
    refreshTokenIds.push(labelOnlyTokenId);
    const relabeled = await updatePosDevice(
      {
        authContext,
        deviceId,
        data: { label: "POS lifecycle smoke renamed", reason: "Smoke rename" },
      },
      db,
    );
    assert.equal(
      relabeled.credentialVersion,
      movedBack.credentialVersion,
      "non-security settings must not rotate the terminal session epoch",
    );
    const labelTokenRows = await db
      .select({ revokedAt: authRefreshTokens.revokedAt })
      .from(authRefreshTokens)
      .where(eq(authRefreshTokens.id, labelOnlyTokenId))
      .limit(1);
    assert.equal(labelTokenRows[0]?.revokedAt, null);

    await db.insert(posStaffShifts).values({
      id: revokeShiftId,
      tenantId,
      branchId: branchAId,
      terminalId,
      staffId: userId,
      status: "on_break",
      openingFloat: "50.00",
      createdBy: userId,
      updatedBy: userId,
    });

    const revokeTokenId = await insertTerminalRefreshToken({
      terminalId,
      tenantId,
      userId,
    });
    refreshTokenIds.push(revokeTokenId);
    const revoked = await revokePosDevice(
      {
        authContext,
        deviceId,
        cookieSecure: true,
        data: { reason: "Smoke retire terminal" },
      },
      db,
    );
    assert.equal(revoked.device.status, "inactive");
    assert.equal(revoked.device.credentialVersion, 12);
    assert.match(revoked.setCookieHeaders[0] ?? "", /Max-Age=0/);
    assert.match(revoked.setCookieHeaders[0] ?? "", /Secure/);
    await assertRefreshTokenRevoked(revokeTokenId);
    await assertRefreshTokenRevoked(labelOnlyTokenId);

    const revokedShiftRows = await db
      .select({
        status: posStaffShifts.status,
        endedAt: posStaffShifts.endedAt,
        closingFloat: posStaffShifts.closingFloat,
      })
      .from(posStaffShifts)
      .where(eq(posStaffShifts.id, revokeShiftId))
      .limit(1);
    assert.equal(revokedShiftRows[0]?.status, "closed");
    assert.ok(revokedShiftRows[0]?.endedAt);
    assert.equal(revokedShiftRows[0]?.closingFloat, null);

    const revokeShiftAuditRows = await db
      .select({ metadata: auditLogs.metadata })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityId, revokeShiftId),
          eq(auditLogs.eventType, "pos.shift.security_forced_closed"),
        ),
      );
    assert.equal(revokeShiftAuditRows.length, 1);
    assert.equal(
      revokeShiftAuditRows[0]?.metadata?.cashReconciliationRequired,
      true,
    );
    assert.equal(
      revokeShiftAuditRows[0]?.metadata?.securityTrigger,
      "terminal_credential_revoked",
    );

    const revokedRows = await db
      .select({
        credentialDigest: posTerminalSettings.credentialDigest,
        credentialVersion: posTerminalSettings.credentialVersion,
        status: posTerminalSettings.status,
      })
      .from(posTerminalSettings)
      .where(eq(posTerminalSettings.id, terminalId))
      .limit(1);
    assert.deepEqual(revokedRows[0], {
      credentialDigest: null,
      credentialVersion: 12,
      status: "inactive",
    });

    await assert.rejects(
      () =>
        updatePosDevice(
          {
            authContext,
            deviceId,
            data: {
              status: "active",
              reason: "A revoked device must be enrolled again",
            },
          },
          db,
        ),
      (error: unknown) =>
        error instanceof PosTerminalAuthError &&
        error.code === "POS_TERMINAL_CREDENTIAL_REVOKED" &&
        error.status === 409,
    );

    const reEnrolled = await rotatePosDeviceCredential(
      {
        authContext,
        deviceId,
        cookieSecure: true,
        data: { reason: "Smoke re-enroll revoked terminal" },
      },
      db,
    );
    assert.equal(reEnrolled.device.status, "active");
    assert.equal(reEnrolled.device.credentialVersion, 13);
    assert.match(
      reEnrolled.setCookieHeaders[0] ?? "",
      /cleanhub_pos_terminal_credential=/,
    );
    const reEnrolledRows = await db
      .select({
        credentialDigest: posTerminalSettings.credentialDigest,
        status: posTerminalSettings.status,
      })
      .from(posTerminalSettings)
      .where(eq(posTerminalSettings.id, terminalId))
      .limit(1);
    assert.equal(reEnrolledRows[0]?.status, "active");
    assert.ok(reEnrolledRows[0]?.credentialDigest);
  } finally {
    await db
      .delete(auditLogs)
      .where(
        inArray(auditLogs.entityId, [
          terminalId,
          shiftId,
          revokeShiftId,
          ...(enrollmentTerminalId ? [enrollmentTerminalId] : []),
        ]),
      );
    await db
      .delete(posStaffShifts)
      .where(eq(posStaffShifts.terminalId, terminalId));
    if (refreshTokenIds.length > 0) {
      await db
        .delete(authRefreshTokens)
        .where(inArray(authRefreshTokens.id, refreshTokenIds));
    }
    await db
      .delete(posTerminalSettings)
      .where(
        inArray(posTerminalSettings.id, [
          terminalId,
          ...(enrollmentTerminalId ? [enrollmentTerminalId] : []),
        ]),
      );
    await db
      .delete(branches)
      .where(inArray(branches.id, [branchAId, branchBId]));
    await db.delete(users).where(eq(users.id, userId));
  }
}

if (process.argv[1]?.endsWith("auth.lifecycle.repository.smoke.ts")) {
  try {
    await runPosTerminalLifecycleRepositorySmoke();
    console.log("POS terminal lifecycle repository smoke passed.");
  } finally {
    await closeDbConnection();
  }
}
