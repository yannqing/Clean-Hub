import assert from "node:assert/strict";

import "../../../config/env.js";

import { and, eq } from "drizzle-orm";

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
import { updateSaasTenantStatus } from "../../saas/tenants/tenants.service.js";

async function insertRefreshToken(input: {
  terminalId: string;
  tenantId: string;
  userId: string;
}): Promise<string> {
  const id = createId();
  await getDb().insert(authRefreshTokens).values({
    id,
    userId: input.userId,
    tenantId: input.tenantId,
    terminalId: input.terminalId,
    tokenHash: `pos-tenant-lifecycle-${createId()}`,
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

export async function runPosTenantStatusLifecycleSmoke(): Promise<void> {
  const db = getDb();
  const saasActorId = createId();
  const tenantId = createId();
  const tenantUserId = createId();
  const branchId = createId();
  const terminalId = createId();
  const shiftId = createId();
  const refreshTokenIds: string[] = [];
  const credentialDigest = "tenant-lifecycle-credential";

  const authContext: AuthContext = {
    userId: saasActorId,
    displayName: "POS tenant lifecycle smoke",
    tenantId: null,
    branchIds: [],
    role: "super_admin",
    roles: ["super_admin"],
    permissions: [],
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  };

  try {
    await db.insert(users).values({
      id: saasActorId,
      tenantId: null,
      userType: "saas",
      passwordHash: "not-used-by-smoke",
      pinHash: "not-used-by-smoke",
      status: "active",
    });
    await db.insert(tenants).values({
      id: tenantId,
      name: "POS tenant lifecycle smoke",
      pressingCode: `POS-${createId()}`,
      status: "active",
    });
    await db.insert(users).values({
      id: tenantUserId,
      tenantId,
      userType: "tenant",
      passwordHash: "not-used-by-smoke",
      pinHash: "not-used-by-smoke",
      status: "active",
    });
    await db.insert(branches).values({
      id: branchId,
      tenantId,
      name: "POS tenant lifecycle smoke branch",
      status: "active",
      createdBy: tenantUserId,
      updatedBy: tenantUserId,
    });
    await db.insert(posTerminalSettings).values({
      id: terminalId,
      tenantId,
      branchId,
      deviceId: `pos-tenant-lifecycle-${createId()}`,
      status: "active",
      credentialDigest,
      credentialVersion: 11,
      credentialIssuedAt: new Date(),
      createdBy: tenantUserId,
      updatedBy: tenantUserId,
    });
    await db.insert(posStaffShifts).values({
      id: shiftId,
      tenantId,
      branchId,
      terminalId,
      staffId: tenantUserId,
      status: "open",
      openingFloat: "350.00",
      createdBy: tenantUserId,
      updatedBy: tenantUserId,
    });

    const suspendTokenId = await insertRefreshToken({
      terminalId,
      tenantId,
      userId: tenantUserId,
    });
    refreshTokenIds.push(suspendTokenId);

    const suspended = await updateSaasTenantStatus(
      {
        authContext,
        tenantId,
        data: {
          status: "suspended",
          reason: "POS tenant lifecycle smoke suspension",
        },
      },
      db,
    );
    assert.equal(suspended.status, "suspended");

    const suspendedTerminalRows = await db
      .select({
        status: posTerminalSettings.status,
        credentialDigest: posTerminalSettings.credentialDigest,
        credentialVersion: posTerminalSettings.credentialVersion,
        version: posTerminalSettings.version,
      })
      .from(posTerminalSettings)
      .where(eq(posTerminalSettings.id, terminalId))
      .limit(1);
    assert.deepEqual(suspendedTerminalRows[0], {
      status: "active",
      credentialDigest,
      credentialVersion: 12,
      version: 2,
    });
    await assertRefreshTokenRevoked(suspendTokenId);

    const closedShiftRows = await db
      .select({
        status: posStaffShifts.status,
        endedAt: posStaffShifts.endedAt,
        closingFloat: posStaffShifts.closingFloat,
        updatedBy: posStaffShifts.updatedBy,
        version: posStaffShifts.version,
      })
      .from(posStaffShifts)
      .where(eq(posStaffShifts.id, shiftId))
      .limit(1);
    assert.equal(closedShiftRows[0]?.status, "closed");
    assert.ok(closedShiftRows[0]?.endedAt);
    assert.equal(closedShiftRows[0]?.closingFloat, null);
    assert.equal(closedShiftRows[0]?.updatedBy, saasActorId);
    assert.equal(closedShiftRows[0]?.version, 2);

    const forcedCloseAuditRows = await db
      .select({
        eventType: auditLogs.eventType,
        metadata: auditLogs.metadata,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, tenantId),
          eq(auditLogs.entityId, shiftId),
          eq(auditLogs.eventType, "pos.shift.security_forced_closed"),
        ),
      );
    assert.equal(forcedCloseAuditRows.length, 1);
    assert.equal(
      forcedCloseAuditRows[0]?.metadata?.cashReconciliationRequired,
      true,
    );

    const reactivateTokenId = await insertRefreshToken({
      terminalId,
      tenantId,
      userId: tenantUserId,
    });
    refreshTokenIds.push(reactivateTokenId);

    const reactivated = await updateSaasTenantStatus(
      {
        authContext,
        tenantId,
        data: {
          status: "active",
          reason: "POS tenant lifecycle smoke reactivation",
        },
      },
      db,
    );
    assert.equal(reactivated.status, "active");

    const reactivatedTerminalRows = await db
      .select({
        status: posTerminalSettings.status,
        credentialDigest: posTerminalSettings.credentialDigest,
        credentialVersion: posTerminalSettings.credentialVersion,
        version: posTerminalSettings.version,
      })
      .from(posTerminalSettings)
      .where(eq(posTerminalSettings.id, terminalId))
      .limit(1);
    assert.deepEqual(reactivatedTerminalRows[0], {
      status: "active",
      credentialDigest,
      credentialVersion: 13,
      version: 3,
    });
    assert.notEqual(
      reactivatedTerminalRows[0]?.credentialVersion,
      11,
      "reactivating a tenant must not revive the pre-suspension POS epoch",
    );
    await assertRefreshTokenRevoked(reactivateTokenId);
  } finally {
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantId));
    for (const refreshTokenId of refreshTokenIds) {
      await db
        .delete(authRefreshTokens)
        .where(eq(authRefreshTokens.id, refreshTokenId));
    }
    await db.delete(posStaffShifts).where(eq(posStaffShifts.id, shiftId));
    await db
      .delete(posTerminalSettings)
      .where(eq(posTerminalSettings.id, terminalId));
    await db.delete(branches).where(eq(branches.id, branchId));
    await db.delete(users).where(eq(users.id, tenantUserId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(users).where(eq(users.id, saasActorId));
  }
}

if (process.argv[1]?.endsWith("tenant-status-lifecycle.smoke.ts")) {
  try {
    await runPosTenantStatusLifecycleSmoke();
    console.log("POS tenant status lifecycle smoke passed.");
  } finally {
    await closeDbConnection();
  }
}
