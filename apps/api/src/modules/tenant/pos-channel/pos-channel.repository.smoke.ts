import assert from "node:assert/strict";

import "../../../config/env.js";

import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  auditLogs,
  branches,
  closeDbConnection,
  getDb,
  posTerminalSettings,
  tenants,
  userBranches,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type { AuthContext } from "../../auth/auth.types.js";
import {
  createPosTerminalSettings,
  heartbeatPosTerminal,
} from "../../pos/terminal-settings/terminal-settings.service.js";
import { TenantPosChannelError } from "./pos-channel.errors.js";
import {
  getTenantPosChannelOverview,
  getTenantPosChannelSettings,
  listTenantPosChannelDevices,
  listTenantPosChannelRegisterSessions,
  removeTenantPosChannelDevice,
  updateTenantPosChannelDevice,
  updateTenantPosChannelSettings,
} from "./pos-channel.service.js";

function createAuthContext(
  tenantId: string,
  userId: string,
  role: "owner" | "manager",
): AuthContext {
  return {
    userId,
    displayName: "POS channel smoke",
    tenantId,
    branchIds: [],
    role,
    roles: [role],
    permissions: [],
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

export async function runTenantPosChannelRepositorySmoke(): Promise<void> {
  const db = getDb();
  const tenantRows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(and(eq(tenants.status, "active"), isNull(tenants.deletedAt)))
    .limit(1);
  const tenantId = tenantRows[0]?.id;
  assert.ok(tenantId, "POS channel smoke requires an active tenant");

  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.tenantId, tenantId),
        eq(users.userType, "tenant"),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  const userId = userRows[0]?.id;
  assert.ok(userId, "POS channel smoke requires an active tenant user");

  const allowedBranchId = createId();
  const deniedBranchId = createId();
  const inactiveBranchId = createId();
  const temporaryBranchIds = [
    allowedBranchId,
    deniedBranchId,
    inactiveBranchId,
  ];
  let terminalId: string | null = null;
  let deniedTerminalId: string | null = null;

  try {
    await db.insert(branches).values([
      {
        id: allowedBranchId,
        tenantId,
        name: "POS channel smoke allowed",
        status: "active",
      },
      {
        id: deniedBranchId,
        tenantId,
        name: "POS channel smoke denied",
        status: "active",
      },
      {
        id: inactiveBranchId,
        tenantId,
        name: "POS channel smoke inactive",
        status: "inactive",
      },
    ]);
    await db.insert(userBranches).values([
      {
        tenantId,
        userId,
        branchId: allowedBranchId,
      },
      {
        tenantId,
        userId,
        branchId: inactiveBranchId,
      },
    ]);

    const manager = createAuthContext(tenantId, userId, "manager");
    const owner = createAuthContext(tenantId, userId, "owner");
    const managerOverview = await getTenantPosChannelOverview(manager, {});

    assert.ok(
      managerOverview.availableBranches.some(
        (branch) => branch.id === allowedBranchId,
      ),
    );
    assert.ok(
      !managerOverview.availableBranches.some(
        (branch) => branch.id === deniedBranchId,
      ),
    );
    assert.ok(
      !managerOverview.availableBranches.some(
        (branch) => branch.id === inactiveBranchId,
      ),
    );

    await assert.rejects(
      () =>
        listTenantPosChannelDevices(manager, {
          branchId: deniedBranchId,
          limit: 10,
          offset: 0,
        }),
      (error: unknown) =>
        error instanceof TenantPosChannelError &&
        error.code === "POS_CHANNEL_BRANCH_NOT_FOUND" &&
        error.status === 404,
    );

    const [devices, sessions, managerSettings, ownerSettings] =
      await Promise.all([
        listTenantPosChannelDevices(owner, { limit: 10, offset: 0 }),
        listTenantPosChannelRegisterSessions(owner, {
          limit: 10,
          offset: 0,
        }),
        getTenantPosChannelSettings(manager),
        getTenantPosChannelSettings(owner),
      ]);

    assert.equal(devices.limit, 10);
    assert.equal(sessions.limit, 10);
    assert.equal(managerSettings.canManage, false);
    assert.equal(ownerSettings.canManage, true);
    assert.ok(
      devices.availableBranches.every((branch) => branch.status === "active"),
    );

    const deniedTerminal = await createPosTerminalSettings(owner, {
      branchId: deniedBranchId,
      deviceId: `pos-channel-denied-${createId()}`,
      label: "POS channel denied terminal",
    });
    deniedTerminalId = deniedTerminal.id;
    await assert.rejects(
      () =>
        updateTenantPosChannelDevice({
          authContext: manager,
          terminalId: deniedTerminal.id,
          data: {
            label: "Unauthorized rename",
            reason: "Verify manager branch scope",
            version: deniedTerminal.version,
          },
        }),
      (error: unknown) =>
        error instanceof TenantPosChannelError &&
        error.code === "POS_CHANNEL_DEVICE_NOT_FOUND" &&
        error.status === 404,
    );

    const terminal = await createPosTerminalSettings(owner, {
      branchId: allowedBranchId,
      deviceId: `pos-channel-smoke-${createId()}`,
      label: "POS channel smoke terminal",
    });
    terminalId = terminal.id;
    assert.equal(terminal.roundingRule, ownerSettings.defaultRoundingRule);
    assert.equal(
      terminal.autoPrintReceipt,
      ownerSettings.defaultAutoPrintReceipt,
    );
    assert.equal(terminal.printCopies, ownerSettings.defaultPrintCopies);
    assert.equal(
      terminal.lockTimeoutSeconds,
      ownerSettings.defaultLockTimeoutSeconds,
    );

    const heartbeat = await heartbeatPosTerminal(
      {
        ...owner,
        terminalId: terminal.id,
        terminalBranchId: allowedBranchId,
        terminalDeviceId: terminal.deviceId,
        terminalCredentialVersion: 0,
      },
      {
        deviceType: "browser",
        platform: "smoke",
        platformVersion: "1",
        appVersion: "1.0.0-smoke",
        syncStatus: "synced",
        lastSyncedAt: new Date().toISOString(),
        lastSyncError: null,
      },
    );
    assert.equal(heartbeat.id, terminal.id);
    assert.equal(heartbeat.deviceType, "browser");
    assert.equal(heartbeat.platform, "smoke");
    assert.ok(heartbeat.lastSeenAt);

    const renamedTerminal = await updateTenantPosChannelDevice({
      authContext: owner,
      terminalId: terminal.id,
      data: {
        label: "POS channel smoke terminal renamed",
        reason: "Verify tenant terminal editing",
        version: heartbeat.version,
      },
    });
    assert.equal(renamedTerminal.version, heartbeat.version + 1);

    const renamedDevices = await listTenantPosChannelDevices(owner, {
      q: "POS channel smoke terminal renamed",
      limit: 10,
      offset: 0,
    });
    assert.equal(renamedDevices.data[0]?.id, terminal.id);

    await removeTenantPosChannelDevice({
      authContext: owner,
      terminalId: terminal.id,
      data: {
        reason: "Verify secure terminal removal",
        version: renamedTerminal.version,
      },
    });
    const devicesAfterRemoval = await listTenantPosChannelDevices(owner, {
      q: terminal.deviceId,
      limit: 10,
      offset: 0,
    });
    assert.ok(
      !devicesAfterRemoval.data.some((device) => device.id === terminal.id),
    );

    await assert.rejects(
      () =>
        updateTenantPosChannelSettings({
          authContext: owner,
          data: {
            cashTrackingEnabled: ownerSettings.cashTrackingEnabled,
            version: ownerSettings.version + 1,
          },
        }),
      (error: unknown) =>
        error instanceof TenantPosChannelError &&
        error.code === "POS_CHANNEL_SETTINGS_CONFLICT" &&
        error.status === 409,
    );
  } finally {
    if (terminalId) {
      await db.delete(auditLogs).where(eq(auditLogs.entityId, terminalId));
      await db
        .delete(posTerminalSettings)
        .where(eq(posTerminalSettings.id, terminalId));
    }
    if (deniedTerminalId) {
      await db
        .delete(auditLogs)
        .where(eq(auditLogs.entityId, deniedTerminalId));
      await db
        .delete(posTerminalSettings)
        .where(eq(posTerminalSettings.id, deniedTerminalId));
    }
    await db
      .delete(userBranches)
      .where(inArray(userBranches.branchId, temporaryBranchIds));
    await db.delete(branches).where(inArray(branches.id, temporaryBranchIds));
  }
}

if (process.argv[1]?.endsWith("pos-channel.repository.smoke.ts")) {
  try {
    await runTenantPosChannelRepositorySmoke();
    console.log("POS channel repository smoke passed.");
  } finally {
    await closeDbConnection();
  }
}
