import assert from "node:assert/strict";

import type { PosHardwareDeviceSummary } from "@cleanhub/api-client";

import { resolvePosPrinterBinding } from "./printer-binding";

function printer(
  config: Record<string, unknown> = {},
): PosHardwareDeviceSummary {
  return {
    id: "01TEST00000000000000000001",
    tenantId: "01TEST00000000000000000002",
    terminalId: "01TEST00000000000000000003",
    name: "前台小票机",
    deviceType: "printer",
    connectionType: "usb",
    config,
    status: "active",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    version: 1,
  };
}

assert.equal(
  resolvePosPrinterBinding({ devices: [], localPrinters: [] }).state,
  "not_configured",
);
assert.equal(
  resolvePosPrinterBinding({ devices: [printer()], localPrinters: [] }).state,
  "not_bound",
);
assert.equal(
  resolvePosPrinterBinding({
    devices: [printer({ printerId: "os-printer", printerName: "Receipt" })],
    localPrinters: [],
  }).state,
  "not_detected",
);
const connected = resolvePosPrinterBinding({
  devices: [printer({ printerId: "os-printer", printerName: "Receipt" })],
  localPrinters: [{ id: "os-printer", name: "Receipt", isDefault: true }],
});
assert.equal(connected.state, "connected");
assert.equal(connected.configured?.printerId, "os-printer");

console.log("POS printer binding smoke passed.");
