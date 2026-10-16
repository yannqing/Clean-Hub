import assert from "node:assert/strict";

import type { Database } from "@cleanhub/db";

import { AuthError } from "../../auth/auth.errors.js";
import type { AuthContext } from "../../auth/auth.types.js";
import {
  authorizeManualDrawerOpen,
  authorizePrivilegedReprint,
  bindPosPrinter,
  connectPosBuiltInHardware,
  recordCashPaymentDrawerResult,
  recordPosPrintJobResult,
} from "./hardware.service.js";
import {
  bindPosPrinterBodySchema,
  connectPosBuiltInHardwareBodySchema,
  recordCashPaymentDrawerResultBodySchema,
} from "./hardware.validation.js";

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
assert.equal(
  auditRows[1]?.eventType,
  "pos_hardware.privileged_reprint.authorized",
);

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

const bindingAuditRows: Array<Record<string, unknown>> = [];
let bindingRow = {
  id: "01K00000000000000000000009",
  tenantId: "01K00000000000000000000001",
  terminalId: "01K00000000000000000000003",
  name: "Front receipt printer",
  deviceType: "printer" as const,
  connectionType: "usb" as const,
  provisioningMode: "manual" as const,
  hardwareKey: null,
  config: { paperWidthMm: 80 },
  status: "active" as const,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  createdBy: null,
  updatedBy: null,
  deletedAt: null,
  deletedBy: null,
  version: 1,
};
const bindingDb = {
  transaction<T>(callback: (tx: Database) => Promise<T>) {
    return callback(this as unknown as Database);
  },
  select() {
    return {
      from() {
        return {
          where() {
            return {
              limit: () => Promise.resolve([bindingRow]),
              orderBy: () => Promise.resolve([bindingRow]),
            };
          },
        };
      },
    };
  },
  update() {
    return {
      set(values: Record<string, unknown>) {
        return {
          where() {
            return {
              returning() {
                bindingRow = {
                  ...bindingRow,
                  ...values,
                  updatedAt: values.updatedAt as Date,
                  version: bindingRow.version + 1,
                };
                return Promise.resolve([bindingRow]);
              },
            };
          },
        };
      },
    };
  },
  insert() {
    return {
      values(value: Record<string, unknown>) {
        bindingAuditRows.push(value);
        return Promise.resolve();
      },
    };
  },
} as unknown as Database;

const boundPrinter = await bindPosPrinter(
  {
    authContext: context("manager"),
    hardwareId: bindingRow.id,
    data: {
      printerId: "os-receipt-printer",
      printerName: "EPSON Receipt",
      isDefault: true,
      version: 1,
    },
  },
  bindingDb,
);
assert.equal(boundPrinter.config.printerId, "os-receipt-printer");
assert.equal(boundPrinter.config.paperWidthMm, 80);
assert.equal(boundPrinter.version, 2);
assert.equal(bindingAuditRows[0]?.tenantId, bindingRow.tenantId);
assert.equal(bindingAuditRows[0]?.eventType, "pos_hardware.printer.bound");

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
  connectPosBuiltInHardware(
    {
      authContext: context("cashier"),
      data: {
        hardwareKey: "t1101:built-in:printer",
        name: "POS-T1101 built-in printer",
        deviceType: "printer",
        localDeviceId: "t1101:built-in",
        deviceModel: "POS-T1101",
      },
    },
    {} as Database,
  ),
  (error) => error instanceof AuthError && error.code === "FORBIDDEN",
);
assert.throws(() =>
  connectPosBuiltInHardwareBodySchema.parse({
    hardwareKey: "caller-controlled:printer",
    name: "Invalid printer",
    deviceType: "printer",
    localDeviceId: "invalid",
  }),
);
assert.equal(
  connectPosBuiltInHardwareBodySchema.parse({
    hardwareKey: "future-x:built-in:printer",
    name: "Future built-in printer",
    deviceType: "printer",
    localDeviceId: "future-x:printer",
    deviceModel: "POS-FUTURE",
  }).hardwareKey,
  "future-x:built-in:printer",
);
assert.throws(() =>
  connectPosBuiltInHardwareBodySchema.parse({
    hardwareKey: "future-x:built-in:scanner",
    name: "Mismatched built-in hardware",
    deviceType: "printer",
    localDeviceId: "future-x:printer",
  }),
);

await assert.rejects(
  bindPosPrinter(
    {
      authContext: context("cashier"),
      hardwareId: "01K00000000000000000000009",
      data: {
        printerId: "local-printer",
        printerName: "Receipt Printer",
        version: 1,
      },
    },
    {} as Database,
  ),
  (error) => error instanceof AuthError && error.code === "FORBIDDEN",
);
for (const identityField of ["tenantId", "terminalId", "branchId"] as const) {
  assert.throws(() =>
    bindPosPrinterBodySchema.parse({
      printerId: "local-printer",
      printerName: "Receipt Printer",
      version: 1,
      [identityField]: "caller-controlled-identity",
    }),
  );
}
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

const cashDrawerAuditRows: Array<Record<string, unknown>> = [];
let paymentEligible = true;
const cashDrawerDb = {
  select(selection: Record<string, unknown>) {
    return {
      from() {
        return {
          where() {
            if ("id" in selection) {
              return {
                limit() {
                  return Promise.resolve(
                    paymentEligible
                      ? [
                          {
                            id: "01K00000000000000000000006",
                            orderId: "01K00000000000000000000007",
                          },
                        ]
                      : [],
                  );
                },
              };
            }

            return Promise.resolve(
              cashDrawerAuditRows.map((row) => ({
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
        cashDrawerAuditRows.push(value);
        return Promise.resolve();
      },
    };
  },
} as unknown as Database;

const cashDrawerResult = await recordCashPaymentDrawerResult(
  {
    authContext: context("cashier"),
    data: {
      paymentId: "01K00000000000000000000006",
      status: "opened",
      attempt: 1,
      printerId: "receipt-printer",
    },
  },
  cashDrawerDb,
);
assert.equal(cashDrawerResult.recorded, true);
assert.equal(
  cashDrawerAuditRows[0]?.eventType,
  "pos_hardware.cash_payment_drawer.opened",
);
assert.equal(cashDrawerAuditRows[0]?.success, true);

const duplicateCashDrawerResult = await recordCashPaymentDrawerResult(
  {
    authContext: context("cashier"),
    data: {
      paymentId: "01K00000000000000000000006",
      status: "opened",
      attempt: 1,
      printerId: "receipt-printer",
    },
  },
  cashDrawerDb,
);
assert.equal(duplicateCashDrawerResult.idempotent, true);
assert.equal(cashDrawerAuditRows.length, 1);

paymentEligible = false;
await assert.rejects(
  recordCashPaymentDrawerResult(
    {
      authContext: context("cashier"),
      data: {
        paymentId: "01K00000000000000000000008",
        status: "failed",
        attempt: 1,
        error: "No drawer configured",
      },
    },
    cashDrawerDb,
  ),
  (error) => error instanceof AuthError && error.code === "FORBIDDEN",
);

assert.throws(() =>
  recordCashPaymentDrawerResultBodySchema.parse({
    paymentId: "01K00000000000000000000006",
    status: "failed",
    attempt: 1,
  }),
);
assert.throws(() =>
  recordCashPaymentDrawerResultBodySchema.parse({
    paymentId: "01K00000000000000000000006",
    status: "opened",
    attempt: 1,
    error: "must not be accepted",
  }),
);

console.log("POS hardware authorization smoke passed.");
