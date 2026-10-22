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
import { updateTenantBranchStatus } from "../../tenant/branches/branches.service.js";

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
    tokenHash: `pos-branch-lifecycle-${createId()}`,
    familyId: createId(),
    expiresAt: new Date(Date.now() + 60_000),
  });
  return id;
}

async function assertTokensRevoked(tokenIds: string[]): Promise<void> {
  const rows = await getDb()
    .select({
      id: authRefreshTokens.id,
      revokedAt: authRefreshTokens.revokedAt,
    })
    .from(authRefreshTokens)
    .where(inArray(authRefreshTokens.id, tokenIds));

  assert.equal(rows.length, tokenIds.length);
  for (const row of rows) {
    assert.ok(row.revokedAt, `refresh token ${row.id} must be revoked`);
  }
}

export async function runPosBranchStatusLifecycleSmoke(): Promise<void> {
  const db = getDb();
  const tenantRows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(and(eq(tenants.status, "active"), isNull(tenants.deletedAt)))
    .limit(1);
  const tenantId = tenantRows[0]?.id;
  assert.ok(tenantId, "branch lifecycle smoke requires an active tenant");

  const actorUserId = createId();
  const secondStaffId = createId();
  const branchId = createId();
  const terminalAId = createId();
  const terminalBId = createId();
  const shiftAId = createId();
  const shiftBId = createId();
  const refreshTokenIds: string[] = [];

  const authContext: AuthContext = {
    userId: actorUserId,
    displayName: "POS branch lifecycle smoke",
    tenantId,
    branchIds: [],
    role: "owner",
    roles: ["owner"],
    permissions: [],
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  };

  try {
    await db.insert(users).values([
      {
        id: actorUserId,
        tenantId,
        userType: "tenant",
        passwordHash: "not-used-by-smoke",
        pinHash: "not-used-by-smoke",
        status: "active",
      },
      {
        id: secondStaffId,
        tenantId,
        userType: "tenant",
        passwordHash: "not-used-by-smoke",
        pinHash: "not-used-by-smoke",
        status: "active",
      },
    ]);
    await db.insert(branches).values({
      id: branchId,
      tenantId,
      name: "POS branch lifecycle smoke",
      status: "active",
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    await db.insert(posTerminalSettings).values([
      {
        id: terminalAId,
        tenantId,
        branchId,
        deviceId: `pos-branch-lifecycle-a-${createId()}`,
        status: "active",
        credentialDigest: "branch-lifecycle-credential-a",
        credentialVersion: 3,
        credentialIssuedAt: new Date(),
        createdBy: actorUserId,
        updatedBy: actorUserId,
      },
      {
        id: terminalBId,
        tenantId,
        branchId,
        deviceId: `pos-branch-lifecycle-b-${createId()}`,
        status: "active",
        credentialDigest: "branch-lifecycle-credential-b",
        credentialVersion: 8,
        credentialIssuedAt: new Date(),
        createdBy: actorUserId,
        updatedBy: actorUserId,
      },
    ]);
    await db.insert(posStaffShifts).values([
      {
        id: shiftAId,
        tenantId,
        branchId,
        terminalId: terminalAId,
        staffId: actorUserId,
        status: "open",
        openingFloat: "100.00",
        createdBy: actorUserId,
        updatedBy: actorUserId,
      },
      {
        id: shiftBId,
        tenantId,
        branchId,
        terminalId: terminalBId,
        staffId: secondStaffId,
        status: "on_break",
        openingFloat: "200.00",
        createdBy: secondStaffId,
        updatedBy: secondStaffId,
      },
    ]);

    const disableTokenIds = await Promise.all([
      insertRefreshToken({
        terminalId: terminalAId,
        tenantId,
        userId: actorUserId,
      }),
      insertRefreshToken({
        terminalId: terminalBId,
        tenantId,
        userId: secondStaffId,
      }),
    ]);
    refreshTokenIds.push(...disableTokenIds);

    const disabledBranch = await updateTenantBranchStatus(
      branchId,
      {
        authContext,
        data: { status: "inactive", version: 1 },
      },
      db,
    );
    assert.equal(disabledBranch.status, "inactive");
    assert.equal(disabledBranch.version, 2);

    const disabledTerminals = await db
      .select({
        id: posTerminalSettings.id,
        credentialVersion: posTerminalSettings.credentialVersion,
        version: posTerminalSettings.version,
      })
      .from(posTerminalSettings)
      .where(
        inArray(posTerminalSettings.id, [terminalAId, terminalBId]),
      );
    const disabledTerminalById = new Map(
      disabledTerminals.map((terminal) => [terminal.id, terminal]),
    );
    assert.equal(
      disabledTerminalById.get(terminalAId)?.credentialVersion,
      4,
    );
    assert.equal(disabledTerminalById.get(terminalAId)?.version, 2);
    assert.equal(
      disabledTerminalById.get(terminalBId)?.credentialVersion,
      9,
    );
    assert.equal(disabledTerminalById.get(terminalBId)?.version, 2);
    await assertTokensRevoked(disableTokenIds);

    const closedShifts = await db
      .select({
        id: posStaffShifts.id,
        status: posStaffShifts.status,
        endedAt: posStaffShifts.endedAt,
        closingFloat: posStaffShifts.closingFloat,
        updatedBy: posStaffShifts.updatedBy,
        version: posStaffShifts.version,
      })
      .from(posStaffShifts)
      .where(inArray(posStaffShifts.id, [shiftAId, shiftBId]));
    assert.equal(closedShifts.length, 2);
    for (const shift of closedShifts) {
      assert.equal(shift.status, "closed");
      assert.ok(shift.endedAt);
      assert.equal(shift.closingFloat, null);
      assert.equal(shift.updatedBy, actorUserId);
      assert.equal(shift.version, 2);
    }

    const forcedCloseAudits = await db
      .select({
        entityId: auditLogs.entityId,
        after: auditLogs.after,
        metadata: auditLogs.metadata,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, tenantId),
          eq(auditLogs.branchId, branchId),
          eq(auditLogs.eventType, "pos.shift.security_forced_closed"),
        ),
      );
    assert.equal(forcedCloseAudits.length, 2);
    for (const audit of forcedCloseAudits) {
      assert.ok([shiftAId, shiftBId].includes(audit.entityId ?? ""));
      assert.equal(audit.after?.status, "closed");
      assert.equal(audit.after?.closingFloat, null);
      assert.equal(audit.metadata?.cashReconciliationRequired, true);
    }

    const enableTokenIds = await Promise.all([
      insertRefreshToken({
        terminalId: terminalAId,
        tenantId,
        userId: actorUserId,
      }),
      insertRefreshToken({
        terminalId: terminalBId,
        tenantId,
        userId: secondStaffId,
      }),
    ]);
    refreshTokenIds.push(...enableTokenIds);

    const enabledBranch = await updateTenantBranchStatus(
      branchId,
      {
        authContext,
        data: {
          status: "active",
          version: disabledBranch.version,
        },
      },
      db,
    );
    assert.equal(enabledBranch.status, "active");
    assert.equal(enabledBranch.version, 3);

    const enabledTerminals = await db
      .select({
        id: posTerminalSettings.id,
        credentialVersion: posTerminalSettings.credentialVersion,
        version: posTerminalSettings.version,
      })
      .from(posTerminalSettings)
      .where(
        inArray(posTerminalSettings.id, [terminalAId, terminalBId]),
      );
    const enabledTerminalById = new Map(
      enabledTerminals.map((terminal) => [terminal.id, terminal]),
    );
    assert.equal(enabledTerminalById.get(terminalAId)?.credentialVersion, 5);
    assert.equal(enabledTerminalById.get(terminalAId)?.version, 3);
    assert.equal(enabledTerminalById.get(terminalBId)?.credentialVersion, 10);
    assert.equal(enabledTerminalById.get(terminalBId)?.version, 3);
    assert.notEqual(
      enabledTerminalById.get(terminalAId)?.credentialVersion,
      3,
      "re-enabling a branch must not revive the pre-disable terminal epoch",
    );
    assert.notEqual(
      enabledTerminalById.get(terminalBId)?.credentialVersion,
      8,
      "re-enabling a branch must not revive the pre-disable terminal epoch",
    );
    await assertTokensRevoked(enableTokenIds);
  } finally {
    await db.delete(auditLogs).where(eq(auditLogs.branchId, branchId));
    if (refreshTokenIds.length > 0) {
      await db
        .delete(authRefreshTokens)
        .where(inArray(authRefreshTokens.id, refreshTokenIds));
    }
    await db
      .delete(posStaffShifts)
      .where(inArray(posStaffShifts.id, [shiftAId, shiftBId]));
    await db
      .delete(posTerminalSettings)
      .where(inArray(posTerminalSettings.id, [terminalAId, terminalBId]));
    await db.delete(branches).where(eq(branches.id, branchId));
    await db
      .delete(users)
      .where(inArray(users.id, [actorUserId, secondStaffId]));
  }
}

if (process.argv[1]?.endsWith("branch-status-lifecycle.smoke.ts")) {
  try {
    await runPosBranchStatusLifecycleSmoke();
    console.log("POS branch status lifecycle smoke passed.");
  } finally {
    await closeDbConnection();
  }
}
