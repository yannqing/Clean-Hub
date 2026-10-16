import assert from "node:assert/strict";

import "../../config/env.js";

import { eq } from "drizzle-orm";

import {
  auditLogs,
  branches,
  closeDbConnection,
  getDb,
  hardwareConfigs,
  posTerminalSettings,
  tenants,
  userBranches,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import { AuthError } from "../auth/auth.errors.js";
import type { AuthContext } from "../auth/auth.types.js";
import { TenantAuditError } from "./audit/audit.errors.js";
import {
  getTenantAuditLogDetail,
  listTenantAuditLogs,
} from "./audit/audit.service.js";
import { HardwareError } from "./hardware/hardware.errors.js";
import {
  createHardwareConfig,
  deleteHardwareConfig,
  listHardwareConfigs,
  updateHardwareConfig,
} from "./hardware/hardware.service.js";

const listAuditQuery = {
  limit: 100,
  offset: 0,
};

const listHardwareQuery = {
  limit: 100,
  offset: 0,
};

function createTenantAuthContext(input: {
  userId: string;
  tenantId: string;
  branchIds: string[];
  role: "owner" | "manager";
}): AuthContext {
  return {
    userId: input.userId,
    displayName: `${input.role} branch-scope smoke`,
    tenantId: input.tenantId,
    branchIds: input.branchIds,
    role: input.role,
    roles: [input.role],
    permissions: [],
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

function isAuthForbidden(error: unknown): boolean {
  return error instanceof AuthError && error.code === "FORBIDDEN";
}

function isNotFound(error: unknown): boolean {
  return (
    (error instanceof TenantAuditError &&
      error.code === "AUDIT_LOG_NOT_FOUND") ||
    (error instanceof HardwareError && error.code === "HARDWARE_NOT_FOUND")
  );
}

export async function runTenantResourceBranchScopeSmokeChecks(): Promise<void> {
  const db = getDb();
  const tenantId = createId();
  const ownerUserId = createId();
  const managerUserId = createId();
  const branchIds = [createId(), createId()] as const;
  const terminalIds = [createId(), createId()] as const;
  const hardwareIds = [createId(), createId()] as const;
  const auditLogIds = [createId(), createId(), createId()] as const;

  const ownerContext = createTenantAuthContext({
    userId: ownerUserId,
    tenantId,
    branchIds: [],
    role: "owner",
  });
  const managerContext = createTenantAuthContext({
    userId: managerUserId,
    tenantId,
    branchIds: [branchIds[0]],
    role: "manager",
  });

  try {
    await db.insert(tenants).values({
      id: tenantId,
      name: "Tenant resource branch-scope smoke",
      pressingCode: `SCOPE-${tenantId}`,
      status: "active",
    });
    await db.insert(users).values([
      {
        id: ownerUserId,
        tenantId,
        userType: "tenant",
        passwordHash: "not-used-by-smoke",
        pinHash: "not-used-by-smoke",
        status: "active",
      },
      {
        id: managerUserId,
        tenantId,
        userType: "tenant",
        passwordHash: "not-used-by-smoke",
        pinHash: "not-used-by-smoke",
        status: "active",
      },
    ]);
    await db.insert(branches).values([
      {
        id: branchIds[0],
        tenantId,
        name: "Manager branch",
        status: "active",
      },
      {
        id: branchIds[1],
        tenantId,
        name: "Other branch",
        status: "active",
      },
    ]);
    await db.insert(userBranches).values({
      userId: managerUserId,
      tenantId,
      branchId: branchIds[0],
    });
    await db.insert(posTerminalSettings).values([
      {
        id: terminalIds[0],
        tenantId,
        branchId: branchIds[0],
        deviceId: `scope-smoke-${terminalIds[0]}`,
        label: "Manager terminal",
      },
      {
        id: terminalIds[1],
        tenantId,
        branchId: branchIds[1],
        deviceId: `scope-smoke-${terminalIds[1]}`,
        label: "Other terminal",
      },
    ]);
    await db.insert(hardwareConfigs).values([
      {
        id: hardwareIds[0],
        tenantId,
        terminalId: terminalIds[0],
        deviceType: "printer",
        name: "Manager printer",
        connectionType: "usb",
      },
      {
        id: hardwareIds[1],
        tenantId,
        terminalId: terminalIds[1],
        deviceType: "scanner",
        name: "Other scanner",
        connectionType: "usb",
      },
    ]);
    await db.insert(auditLogs).values([
      {
        id: auditLogIds[0],
        tenantId,
        branchId: branchIds[0],
        eventCategory: "scope_smoke",
        eventType: "scope_smoke.manager_branch",
      },
      {
        id: auditLogIds[1],
        tenantId,
        branchId: branchIds[1],
        eventCategory: "scope_smoke",
        eventType: "scope_smoke.other_branch",
      },
      {
        id: auditLogIds[2],
        tenantId,
        eventCategory: "scope_smoke",
        eventType: "scope_smoke.tenant_wide",
      },
    ]);

    const ownerLogs = await listTenantAuditLogs(
      { authContext: ownerContext, query: listAuditQuery },
      db,
    );
    const managerLogs = await listTenantAuditLogs(
      { authContext: managerContext, query: listAuditQuery },
      db,
    );

    assert.equal(ownerLogs.total, 3);
    assert.deepEqual(
      managerLogs.items.map((item) => item.id),
      [auditLogIds[0]],
    );
    assert.equal(
      (
        await getTenantAuditLogDetail(
          { authContext: managerContext, logId: auditLogIds[0] },
          db,
        )
      ).id,
      auditLogIds[0],
    );
    await assert.rejects(
      getTenantAuditLogDetail(
        { authContext: managerContext, logId: auditLogIds[1] },
        db,
      ),
      isNotFound,
    );
    await assert.rejects(
      getTenantAuditLogDetail(
        { authContext: managerContext, logId: auditLogIds[2] },
        db,
      ),
      isNotFound,
    );
    assert.equal(
      (
        await getTenantAuditLogDetail(
          { authContext: ownerContext, logId: auditLogIds[2] },
          db,
        )
      ).id,
      auditLogIds[2],
    );

    const ownerHardware = await listHardwareConfigs(
      { authContext: ownerContext, query: listHardwareQuery },
      db,
    );
    const managerHardware = await listHardwareConfigs(
      { authContext: managerContext, query: listHardwareQuery },
      db,
    );

    assert.equal(ownerHardware.length, 2);
    assert.deepEqual(
      managerHardware.map((item) => item.id),
      [hardwareIds[0]],
    );

    const updated = await updateHardwareConfig(
      {
        authContext: managerContext,
        hardwareId: hardwareIds[0],
        data: { name: "Updated manager printer", version: 1 },
      },
      db,
    );
    assert.equal(updated.name, "Updated manager printer");

    await assert.rejects(
      updateHardwareConfig(
        {
          authContext: managerContext,
          hardwareId: hardwareIds[1],
          data: { name: "Must remain hidden", version: 1 },
        },
        db,
      ),
      isNotFound,
    );
    await assert.rejects(
      updateHardwareConfig(
        {
          authContext: managerContext,
          hardwareId: hardwareIds[0],
          data: { terminalId: terminalIds[1], version: updated.version },
        },
        db,
      ),
      isAuthForbidden,
    );
    await assert.rejects(
      deleteHardwareConfig(
        {
          authContext: managerContext,
          hardwareId: hardwareIds[1],
          version: 1,
        },
        db,
      ),
      isNotFound,
    );

    const created = await createHardwareConfig(
      {
        authContext: managerContext,
        data: {
          terminalId: terminalIds[0],
          name: "Manager cash drawer",
          deviceType: "cash_drawer",
          connectionType: "usb",
        },
      },
      db,
    );
    assert.equal(created.branchId, branchIds[0]);
    await assert.rejects(
      createHardwareConfig(
        {
          authContext: managerContext,
          data: {
            terminalId: terminalIds[1],
            name: "Unauthorized printer",
            deviceType: "printer",
            connectionType: "network",
          },
        },
        db,
      ),
      isAuthForbidden,
    );

    await deleteHardwareConfig(
      {
        authContext: managerContext,
        hardwareId: hardwareIds[0],
        version: updated.version,
      },
      db,
    );

    await db
      .update(tenants)
      .set({ status: "suspended" })
      .where(eq(tenants.id, tenantId));

    await assert.rejects(
      listTenantAuditLogs(
        { authContext: ownerContext, query: listAuditQuery },
        db,
      ),
      isAuthForbidden,
    );
    await assert.rejects(
      listHardwareConfigs(
        { authContext: ownerContext, query: listHardwareQuery },
        db,
      ),
      isAuthForbidden,
    );
  } finally {
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantId));
    await db
      .delete(hardwareConfigs)
      .where(eq(hardwareConfigs.tenantId, tenantId));
    await db
      .delete(posTerminalSettings)
      .where(eq(posTerminalSettings.tenantId, tenantId));
    await db.delete(userBranches).where(eq(userBranches.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }
}

if (process.argv[1]?.endsWith("tenant-resource-branch-scope.smoke.ts")) {
  try {
    await runTenantResourceBranchScopeSmokeChecks();
    console.log("Tenant resource branch-scope smoke passed.");
  } finally {
    await closeDbConnection();
  }
}
