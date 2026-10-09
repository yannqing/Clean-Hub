import assert from "node:assert/strict";

import type { PosHardwareDeviceSummary } from "@cleanhub/api-client";

import { resolvePosPrinterBinding } from "./printer-binding";

function printer(
  config: Record<string, unknown> = {},
  id = "01TEST00000000000000000001",
): PosHardwareDeviceSummary {
  return {
    id,
    tenantId: "01TEST00000000000000000002",
    terminalId: "01TEST00000000000000000003",
    name: "前台小票机",
    deviceType: "printer",
    connectionType: "usb",
    provisioningMode: "manual",
    hardwareKey: null,
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

const defaultBluetooth = resolvePosPrinterBinding({
  devices: [
    printer({
      printerId: "t1101:built-in",
      printerName: "Built in",
      printerPurpose: "receipt",
      printerIsDefault: false,
    }),
    printer(
      {
        printerId: "bluetooth:AA:BB:CC:DD:EE:FF",
        printerName: "OCPP-M15",
        printerPurpose: "receipt",
        printerIsDefault: true,
      },
      "01TEST00000000000000000004",
    ),
    printer(
      {
        printerId: "label-printer",
        printerName: "Label printer",
        printerPurpose: "label",
        printerIsDefault: true,
      },
      "01TEST00000000000000000005",
    ),
  ],
  localPrinters: [
    { id: "t1101:built-in", name: "Built in", isDefault: true },
    {
      id: "bluetooth:AA:BB:CC:DD:EE:FF",
      name: "OCPP-M15",
      isDefault: false,
    },
    { id: "label-printer", name: "Label printer", isDefault: false },
  ],
});
assert.equal(defaultBluetooth.state, "connected");
assert.equal(
  defaultBluetooth.configured?.printerId,
  "bluetooth:AA:BB:CC:DD:EE:FF",
  "receipt routing must prefer the configured logical default over the T1101 system default",
);

console.log("POS printer binding smoke passed.");
