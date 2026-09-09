import assert from "node:assert/strict";

import "../../../config/env.js";

import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  auditLogs,
  branches,
  closeDbConnection,
  getDb,
  posCashDrawerSessions,
  posRegisterSessions,
  posStaffShifts,
  posTerminalSettings,
  tenants,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type { AuthContext } from "../../auth/auth.types.js";
import { updateTenantBranchStatus } from "../../tenant/branches/branches.service.js";
import { clockAction } from "../staff/staff.service.js";
import { securityForceClosePosTerminalShifts } from "./terminal-lifecycle.repository.js";

/**
 * Clock-in must record the terminal it happened on. A null terminal silently
 * excludes the shift from every `terminal_id in (...)` security sweep, because
 * SQL `null in (...)` is never true.
 */
async function assertClockInRecordsTerminal(input: {
  authContext: AuthContext;
  terminalId: string;
}): Promise<string> {
  const shift = await clockAction({
    authContext: input.authContext,
    data: { action: "clock_in" },
  });
  assert.equal(
    shift.terminalId,
    input.terminalId,
    "clock-in must record the originating terminal so security sweeps match it",
  );
  return shift.id;
}

export async function runPosRegisterSessionLifecycleSmoke(): Promise<void> {
  const db = getDb();
  const tenantRows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(and(eq(tenants.status, "active"), isNull(tenants.deletedAt)))
    .limit(1);
  const tenantId = tenantRows[0]?.id;
  assert.ok(tenantId, "register lifecycle smoke requires an active tenant");

  const actorUserId = createId();
  const secondStaffId = createId();
  const branchId = createId();
  const terminalId = createId();
  const otherTerminalId = createId();
  const registerSessionId = createId();
  const cashDrawerSessionId = createId();
  const otherRegisterSessionId = createId();
  const deviceId = `pos-register-lifecycle-${createId()}`;
  const otherDeviceId = `pos-register-lifecycle-other-${createId()}`;
  const credentialVersion = 4;
  let clockedShiftId: string | null = null;

  const terminalAuthContext: AuthContext = {
    userId: actorUserId,
    displayName: "POS register lifecycle smoke",
    tenantId,
    branchIds: [branchId],
    role: "owner",
    roles: ["owner"],
    permissions: [],
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    terminalId,
    terminalBranchId: branchId,
    terminalDeviceId: deviceId,
    terminalCredentialVersion: credentialVersion,
  };

  const adminAuthContext: AuthContext = {
    userId: actorUserId,
    displayName: "POS register lifecycle smoke admin",
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
      name: "POS register lifecycle smoke",
      status: "active",
      defaultCurrency: "XOF",
      cashHandlingMode: "shared_drawer",
      paymentMethodsEnabled: ["cash", "app"],
      defaultPaymentMethod: "cash",
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    await db.insert(posTerminalSettings).values([
      {
        id: terminalId,
        tenantId,
        branchId,
        deviceId,
        status: "active",
        credentialDigest: "register-lifecycle-credential",
        credentialVersion,
        credentialIssuedAt: new Date(),
        createdBy: actorUserId,
        updatedBy: actorUserId,
      },
      {
        id: otherTerminalId,
        tenantId,
        branchId,
        deviceId: otherDeviceId,
        status: "active",
        credentialDigest: "register-lifecycle-credential-other",
        credentialVersion,
        credentialIssuedAt: new Date(),
        createdBy: actorUserId,
        updatedBy: actorUserId,
      },
    ]);

    clockedShiftId = await assertClockInRecordsTerminal({
      authContext: terminalAuthContext,
      terminalId,
    });

    await db.insert(posRegisterSessions).values([
      {
        id: registerSessionId,
        tenantId,
        branchId,
        terminalId,
        currency: "XOF",
        status: "open",
        openedBy: actorUserId,
      },
      {
        id: otherRegisterSessionId,
        tenantId,
        branchId,
        terminalId: otherTerminalId,
        currency: "XOF",
        status: "open",
        openedBy: secondStaffId,
      },
    ]);
    await db.insert(posCashDrawerSessions).values({
      id: cashDrawerSessionId,
      tenantId,
      branchId,
      terminalId,
      registerSessionId,
      handlingMode: "shared_drawer",
      currency: "XOF",
      status: "open",
      openingFloat: "150.00",
      openedBy: actorUserId,
    });

    // Revoking one employee must not close a register the whole store shares.
    await securityForceClosePosTerminalShifts(db, {
      tenantId,
      terminalIds: [terminalId, otherTerminalId],
      staffId: secondStaffId,
      actorUserId,
      reason: "Staff-scoped revocation must not close terminal registers.",
      metadata: { trigger: "register_lifecycle_smoke_staff_scope" },
    });

    const registersAfterStaffRevoke = await db
      .select({
        id: posRegisterSessions.id,
        status: posRegisterSessions.status,
      })
      .from(posRegisterSessions)
      .where(
        inArray(posRegisterSessions.id, [
          registerSessionId,
          otherRegisterSessionId,
        ]),
      );
    assert.equal(registersAfterStaffRevoke.length, 2);
    for (const session of registersAfterStaffRevoke) {
      assert.equal(
        session.status,
        "open",
        "a staff-scoped security close must leave terminal register sessions open",
      );
    }

    const disabledBranch = await updateTenantBranchStatus(
      branchId,
      {
        authContext: adminAuthContext,
        data: { status: "inactive", version: 1 },
      },
      db,
    );
    assert.equal(disabledBranch.status, "inactive");

    const closedRegisters = await db
      .select({
        id: posRegisterSessions.id,
        status: posRegisterSessions.status,
        closedAt: posRegisterSessions.closedAt,
        closedBy: posRegisterSessions.closedBy,
        version: posRegisterSessions.version,
      })
      .from(posRegisterSessions)
      .where(
        inArray(posRegisterSessions.id, [
          registerSessionId,
          otherRegisterSessionId,
        ]),
      );
    assert.equal(closedRegisters.length, 2);
    for (const session of closedRegisters) {
      assert.equal(
        session.status,
        "closed",
        "disabling a branch must close every open register on its terminals",
      );
      assert.ok(session.closedAt);
      assert.equal(session.closedBy, actorUserId);
      assert.equal(session.version, 2);
    }

    const [closedDrawer] = await db
      .select({
        status: posCashDrawerSessions.status,
        closedAt: posCashDrawerSessions.closedAt,
        closedBy: posCashDrawerSessions.closedBy,
        countedCash: posCashDrawerSessions.countedCash,
      })
      .from(posCashDrawerSessions)
      .where(eq(posCashDrawerSessions.id, cashDrawerSessionId));
    assert.ok(closedDrawer);
    assert.equal(closedDrawer.status, "closed");
    assert.ok(closedDrawer.closedAt);
    assert.equal(closedDrawer.closedBy, actorUserId);
    assert.equal(
      closedDrawer.countedCash,
      null,
      "a security close records no counted cash so reconciliation stays outstanding",
    );

    const [closedShift] = await db
      .select({ status: posStaffShifts.status })
      .from(posStaffShifts)
      .where(eq(posStaffShifts.id, clockedShiftId));
    assert.equal(
      closedShift?.status,
      "closed",
      "a shift opened through clock-in must be reachable by the security sweep",
    );

    const registerAudits = await db
      .select({
        entityId: auditLogs.entityId,
        metadata: auditLogs.metadata,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, tenantId),
          eq(auditLogs.branchId, branchId),
          eq(auditLogs.eventType, "pos.register.security_forced_closed"),
        ),
      );
    assert.equal(registerAudits.length, 2);
    for (const audit of registerAudits) {
      assert.ok(
        [registerSessionId, otherRegisterSessionId].includes(
          audit.entityId ?? "",
        ),
      );
      assert.equal(audit.metadata?.cashReconciliationRequired, true);
      assert.equal(audit.metadata?.zReportGenerated, false);
    }
  } finally {
    await db.delete(auditLogs).where(eq(auditLogs.branchId, branchId));
    await db
      .delete(posCashDrawerSessions)
      .where(eq(posCashDrawerSessions.id, cashDrawerSessionId));
    await db
      .delete(posRegisterSessions)
      .where(
        inArray(posRegisterSessions.id, [
          registerSessionId,
          otherRegisterSessionId,
        ]),
      );
    await db.delete(posStaffShifts).where(eq(posStaffShifts.branchId, branchId));
    await db
      .delete(posTerminalSettings)
      .where(inArray(posTerminalSettings.id, [terminalId, otherTerminalId]));
    await db.delete(branches).where(eq(branches.id, branchId));
    await db
      .delete(users)
      .where(inArray(users.id, [actorUserId, secondStaffId]));
  }
}

if (process.argv[1]?.endsWith("register-session-lifecycle.smoke.ts")) {
  try {
    await runPosRegisterSessionLifecycleSmoke();
    console.log("POS register session lifecycle smoke passed.");
  } finally {
    await closeDbConnection();
  }
}
