import assert from "node:assert/strict";

import {
  discoverBuiltInHardware,
  inspectBuiltInHardware,
} from "./built-in-hardware";
import { isAndroidPosNativeRuntime } from "./t1101-bridge";
import { isAutoRecoverablePrintJob } from "./use-print-job-recovery";

async function main(): Promise<void> {
  assert.equal(
    isAndroidPosNativeRuntime({ isNative: true, platform: "android" }),
    true,
  );

  const discovered = await discoverBuiltInHardware({
    async getCapabilities() {
      return {
        scanner: true,
        printer: true,
        cashDrawer: true,
        cardTerminal: false,
        secureTerminalCredential: true,
        connected: true,
        host: "pos-t1101",
        hardwareModel: "POS-T1101",
        builtInDevices: [
          {
            hardwareKey: "t1101:built-in:printer",
            name: "POS-T1101 内置热敏打印机",
            deviceType: "printer" as const,
            localDeviceId: "t1101:built-in",
            available: true,
            deviceModel: "POS-T1101",
          },
          {
            hardwareKey: "t1101:built-in:scanner",
            name: "POS-T1101 内置扫码器",
            deviceType: "scanner" as const,
            localDeviceId: "t1101:built-in",
            available: true,
            deviceModel: "POS-T1101",
          },
        ],
      };
    },
    async listPrinters() {
      return [
        {
          id: "t1101:built-in",
          name: "POS-T1101 内置热敏打印机",
          isDefault: true,
        },
      ];
    },
    async print(request) {
      return { jobId: request.id, status: "printed" as const };
    },
    async openCashDrawer() {},
    async processCardPayment() {
      return { status: "failed" as const };
    },
    onScan() {
      return () => {};
    },
  });
  assert.deepEqual(
    discovered.devices.map((device) => device.hardwareKey),
    ["t1101:built-in:printer", "t1101:built-in:scanner"],
    "the T1101 printer and scanner must appear before admin configuration",
  );
  assert.equal(discovered.localPrinters[0]?.id, "t1101:built-in");

  const t8Discovered = await discoverBuiltInHardware({
    async getCapabilities() {
      return {
        scanner: true,
        printer: true,
        cashDrawer: true,
        cardTerminal: false,
        secureTerminalCredential: false,
        connected: true,
        host: "pos-t8",
        hardwareModel: "POS-T8",
        builtInDevices: [
          {
            hardwareKey: "t8:built-in:printer",
            name: "POS-T8 内置热敏打印机",
            deviceType: "printer" as const,
            localDeviceId: "t8:built-in",
            available: true,
            deviceModel: "POS-T8",
          },
          {
            hardwareKey: "t8:built-in:scanner",
            name: "POS-T8 内置扫码器",
            deviceType: "scanner" as const,
            localDeviceId: "t8:built-in",
            available: true,
            deviceModel: "POS-T8",
          },
        ],
      };
    },
    async listPrinters() {
      return [
        {
          id: "t8:built-in",
          name: "POS-T8 内置热敏打印机",
          isDefault: true,
        },
      ];
    },
    async print(request) {
      return { jobId: request.id, status: "printed" as const };
    },
    async openCashDrawer() {},
    async processCardPayment() {
      return { status: "failed" as const };
    },
    onScan() {
      return () => {};
    },
  });
  assert.deepEqual(
    t8Discovered.devices.map((device) => device.hardwareKey),
    ["t8:built-in:printer", "t8:built-in:scanner"],
    "the T8 must expose only its own built-in printer and scanner",
  );
  assert.equal(t8Discovered.localPrinters[0]?.id, "t8:built-in");

  const genericAndroid = await discoverBuiltInHardware({
    async getCapabilities() {
      return {
        scanner: false,
        printer: true,
        cashDrawer: false,
        cardTerminal: false,
        secureTerminalCredential: false,
        connected: false,
        host: "android",
        builtInDevices: [],
      };
    },
    async listPrinters() {
      return [
        {
          id: "bluetooth:AA:BB:CC:DD:EE:FF",
          name: "Local receipt printer",
          isDefault: false,
        },
      ];
    },
    async print(request) {
      return { jobId: request.id, status: "printed" as const };
    },
    async openCashDrawer() {},
    async processCardPayment() {
      return { status: "failed" as const };
    },
    onScan() {
      return () => {};
    },
  });
  assert.deepEqual(
    genericAndroid.devices,
    [],
    "an unsupported Android device must not be presented as a T1101",
  );
  assert.equal(genericAndroid.localPrinters.length, 1);

  const disconnected = await discoverBuiltInHardware({
    async getCapabilities() {
      return {
        scanner: false,
        printer: false,
        cashDrawer: false,
        cardTerminal: false,
        secureTerminalCredential: false,
        connected: false,
        host: "pos-t1101",
        hardwareModel: "POS-T1101",
        builtInDevices: [
          {
            hardwareKey: "t1101:built-in:printer",
            name: "POS-T1101 内置热敏打印机",
            deviceType: "printer" as const,
            localDeviceId: "t1101:built-in",
            available: false,
            deviceModel: "POS-T1101",
          },
          {
            hardwareKey: "t1101:built-in:scanner",
            name: "POS-T1101 内置扫码器",
            deviceType: "scanner" as const,
            localDeviceId: "t1101:built-in",
            available: false,
            deviceModel: "POS-T1101",
          },
        ],
      };
    },
    async listPrinters() {
      throw new Error("printer service is still binding");
    },
    async print(request) {
      return { jobId: request.id, status: "failed" as const };
    },
    async openCashDrawer() {},
    async processCardPayment() {
      return { status: "failed" as const };
    },
    onScan() {
      return () => {};
    },
  });
  assert.deepEqual(
    disconnected.devices.map((device) => ({
      hardwareKey: device.hardwareKey,
      available: device.available,
    })),
    [
      { hardwareKey: "t1101:built-in:printer", available: false },
      { hardwareKey: "t1101:built-in:scanner", available: false },
    ],
    "known built-in devices must remain visible while the native service reconnects",
  );

  let listedExternalPrinters = false;
  const setupInspection = await inspectBuiltInHardware({
    async getCapabilities() {
      return {
        scanner: true,
        printer: true,
        cashDrawer: false,
        cardTerminal: false,
        secureTerminalCredential: false,
        hardwareModel: "POS-FUTURE",
        builtInDevices: [
          {
            hardwareKey: "future-x:built-in:printer",
            name: "Future built-in printer",
            deviceType: "printer" as const,
            localDeviceId: "future-x:printer",
            available: true,
            deviceModel: "POS-FUTURE",
          },
        ],
      };
    },
    async listPrinters() {
      listedExternalPrinters = true;
      return [];
    },
    async print(request) {
      return { jobId: request.id, status: "printed" as const };
    },
    async openCashDrawer() {},
    async processCardPayment() {
      return { status: "failed" as const };
    },
    onScan() {
      return () => {};
    },
  });
  assert.equal(listedExternalPrinters, false);
  assert.equal(
    setupInspection.devices[0]?.hardwareKey,
    "future-x:built-in:printer",
    "setup must consume native inventory without model-specific web code",
  );
  assert.equal(
    isAndroidPosNativeRuntime({ isNative: false, platform: "android" }),
    false,
  );
  assert.equal(
    isAndroidPosNativeRuntime({ isNative: true, platform: "ios" }),
    false,
  );

  const printJob = {
    id: "01TEST00000000000000000001",
    idempotencyKey: "test",
    payload: {
      documentType: "receipt" as const,
      entityId: "01TEST00000000000000000002",
      title: "Receipt",
      content: "Receipt",
      autoPrint: true,
    },
    status: "pending" as const,
    attempt: 0,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  assert.equal(isAutoRecoverablePrintJob(printJob), true);
  assert.equal(
    isAutoRecoverablePrintJob({ ...printJob, status: "printing" }),
    false,
  );
  assert.equal(
    isAutoRecoverablePrintJob({
      ...printJob,
      payload: { ...printJob.payload, autoPrint: false },
    }),
    false,
  );

  console.log("Android POS bridge runtime smoke passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
