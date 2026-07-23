import assert from "node:assert/strict";

import type { Database } from "@cleanhub/db";

import { AuthError } from "../../auth/auth.errors.js";
import type { AuthContext } from "../../auth/auth.types.js";
import {
  authorizeManualDrawerOpen,
  authorizePrivilegedReprint,
  recordPosPrintJobResult,
} from "./hardware.service.js";

function context(role: "manager" | "cashier"): AuthContext {
  return {
    userId: `user_${role}`,
    displayName: role,
    tenantId: "01K00000000000000000000001",
    branchIds: ["01K00000000000000000000002"],
    role,
    roles: [role],
    permissions: [],
    terminalId: "01K00000000000000000000003",
    terminalBranchId: "01K00000000000000000000002",
    terminalDeviceId: "terminal-device",
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

const auditRows: Array<Record<string, unknown>> = [];
const db = {
  select() {
    return {
      from() {
        return {
          where() {
            return Promise.resolve(
              auditRows.map((row) => ({
                eventType: row.eventType,
                metadata: row.metadata,
              })),
            );
          },
        };
      },
    };
  },
  insert() {
    return {
      values(value: Record<string, unknown>) {
        auditRows.push(value);
        return Promise.resolve();
      },
    };
  },
} as unknown as Database;

const drawer = await authorizeManualDrawerOpen(
  {
    authContext: context("manager"),
    data: { reason: "  Cash count verification  " },
  },
  db,
);
assert.equal(drawer.action, "manual_drawer_open");
assert.equal(drawer.reason, "Cash count verification");
assert.equal(drawer.terminalId, "01K00000000000000000000003");
assert.equal(auditRows[0]?.branchId, "01K00000000000000000000002");
assert.equal(auditRows[0]?.reason, "Cash count verification");
assert.deepEqual(auditRows[0]?.metadata, {
  authorizationId: drawer.authorizationId,
  action: "manual_drawer_open",
  terminalId: "01K00000000000000000000003",
  terminalBranchId: "01K00000000000000000000002",
  terminalDeviceId: "terminal-device",
});

const reprint = await authorizePrivilegedReprint(
  {
    authContext: context("manager"),
    data: {
      reason: "Customer requested a duplicate",
      documentType: "receipt",
      entityId: "01K00000000000000000000004",
    },
  },
  db,
);
assert.equal(reprint.action, "privileged_reprint");
assert.equal(auditRows[1]?.eventType, "pos_hardware.privileged_reprint.authorized");

const printJobId = "01K00000000000000000000005";
const printed = await recordPosPrintJobResult(
  {
    authContext: context("manager"),
    data: {
      jobId: printJobId,
      documentType: "receipt",
      entityId: "01K00000000000000000000004",
      status: "printed",
      attempt: 1,
      authorizationId: reprint.authorizationId,
    },
  },
  db,
);
assert.equal(printed.recorded, true);
assert.equal(auditRows[2]?.eventType, "pos_hardware.print_job.printed");
assert.equal(auditRows[2]?.entityId, printJobId);
assert.equal(auditRows[2]?.success, true);

const duplicatePrinted = await recordPosPrintJobResult(
  {
    authContext: context("manager"),
    data: {
      jobId: printJobId,
      documentType: "receipt",
      entityId: "01K00000000000000000000004",
      status: "printed",
      attempt: 1,
      authorizationId: reprint.authorizationId,
    },
  },
  db,
);
assert.equal(duplicatePrinted.idempotent, true);
assert.equal(
  auditRows.filter((row) => row.eventType === "pos_hardware.print_job.printed")
    .length,
  1,
  "a retried result report must not create duplicate success audit events",
);

await assert.rejects(
  authorizeManualDrawerOpen(
    {
      authContext: context("cashier"),
      data: { reason: "Drawer check" },
    },
    db,
  ),
  (error) => error instanceof AuthError && error.code === "FORBIDDEN",
);
await assert.rejects(
  authorizeManualDrawerOpen(
    {
      authContext: context("manager"),
      data: { reason: " " },
    },
    db,
  ),
  /reason is required/i,
);

console.log("POS hardware authorization smoke passed.");
