import {
  createPosHardwareRuntime,
  createUnavailablePosCashDrawerAdapter,
  createUnavailablePosScannerAdapter,
  type PosPrinterAdapter,
} from "@cleanhub/hardware";

import { desktopIpcChannels } from "./bridge.js";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const channelNames = Object.values(desktopIpcChannels);
assert(
  new Set(channelNames).size === channelNames.length,
  "desktop IPC channels must be unique",
);

const printer: PosPrinterAdapter = {
  isAvailable: () => true,
  async listPrinters() {
    return [{ id: "printer_1", name: "Test Printer", isDefault: true }];
  },
  async print(request) {
    return { jobId: request.id, status: "printed" };
  },
};
const runtime = createPosHardwareRuntime({
  scanner: createUnavailablePosScannerAdapter(),
  printer,
  cashDrawer: createUnavailablePosCashDrawerAdapter(),
  secureTerminalCredential: () => true,
});
const capabilities = await runtime.getCapabilities();
assert(!capabilities.scanner, "unconfigured native scanner must be unavailable");
assert(capabilities.printer, "injected printer adapter must be available");
assert(!capabilities.cashDrawer, "unknown cash drawer must be unavailable");
assert(
  capabilities.secureTerminalCredential,
  "secure credential capability must be discovered",
);
assert(
  (await runtime.print({ id: "job_1", printerId: "printer_1", content: "x" }))
    .status === "printed",
  "desktop printer adapter must preserve job status",
);

console.log("desktop smoke ok");
