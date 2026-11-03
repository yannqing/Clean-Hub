import assert from "node:assert/strict";

import type {
  PosHardwareDeviceSummary,
  RecordCashPaymentDrawerResultRequest,
} from "@cleanhub/api-client";
import type { PosDrawerOpenRequest } from "@cleanhub/hardware";
import { createMemoryStorage } from "@cleanhub/offline";

import {
  openCashDrawerForPayment,
  openCashDrawerForPaymentOnce,
  resolveCashDrawerConfiguration,
} from "./cash-drawer";

async function runCashDrawerSmoke(): Promise<void> {
  const drawer: PosHardwareDeviceSummary = {
    id: "drawer_1",
    tenantId: "tenant_1",
    terminalId: "terminal_1",
    name: "Front drawer",
    deviceType: "cash_drawer",
    connectionType: "usb",
    provisioningMode: "manual",
    hardwareKey: null,
    config: {
      printerId: "receipt-printer",
      pulse: { pin: 1, onTimeMs: 100, offTimeMs: 200 },
    },
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  assert.deepEqual(resolveCashDrawerConfiguration(drawer.config), {
    printerId: "receipt-printer",
    pulse: { pin: 1, onTimeMs: 100, offTimeMs: 200 },
  });
  assert.throws(
    () => resolveCashDrawerConfiguration({ pulse: { pin: 2 } }),
    /0.*1/,
  );

  const openedRequests: PosDrawerOpenRequest[] = [];
  const reported: RecordCashPaymentDrawerResultRequest[] = [];
  const outcome = await openCashDrawerForPayment({
    paymentId: "payment_1",
    loadDevices: async () => [drawer],
    hardware: {
      async getCapabilities() {
        return {
          scanner: false,
          printer: true,
          cashDrawer: true,
          cardTerminal: false,
          secureTerminalCredential: true,
        };
      },
      async openCashDrawer(request) {
        openedRequests.push(request);
      },
    },
    async reportResult(result) {
      reported.push(result);
    },
  });
  assert.equal(outcome.opened, true);
  assert.equal(openedRequests[0]?.printerId, "receipt-printer");
  assert.deepEqual(openedRequests[0]?.trigger, {
    type: "cash_payment",
    paymentId: "payment_1",
  });
  assert.equal(reported[0]?.status, "opened");

  const durableStorage = createMemoryStorage();
  openedRequests.length = 0;
  const onceInput = {
    paymentId: "payment_exactly_once",
    scope: {
      tenantId: "tenant_1",
      branchId: "branch_1",
      terminalId: "terminal_1",
    },
    storage: durableStorage,
    loadDevices: async () => [drawer],
    hardware: {
      async getCapabilities() {
        return {
          scanner: false,
          printer: true,
          cashDrawer: true,
          cardTerminal: false,
          secureTerminalCredential: true,
        };
      },
      async openCashDrawer(request: PosDrawerOpenRequest) {
        openedRequests.push(request);
      },
    },
    async reportResult() {},
  };
  assert.equal((await openCashDrawerForPaymentOnce(onceInput)).opened, true);
  assert.equal((await openCashDrawerForPaymentOnce(onceInput)).opened, false);
  assert.equal(
    openedRequests.length,
    1,
    "a durable cash payment marker must suppress repeated drawer pulses",
  );

  const uncertainStorage = createMemoryStorage();
  await uncertainStorage.setItem(
    [
      "cleanhub.pos.offline.drawer.v1",
      "tenant_1",
      "branch_1",
      "terminal_1",
      "payment_uncertain",
    ].join(":"),
    "opening",
  );
  const uncertain = await openCashDrawerForPaymentOnce({
    ...onceInput,
    paymentId: "payment_uncertain",
    storage: uncertainStorage,
  });
  assert.equal(uncertain.opened, false);
  assert.match(uncertain.opened ? "" : uncertain.message, /不确定/);

  reported.length = 0;
  const missingBridge = await openCashDrawerForPayment({
    paymentId: "payment_2",
    loadDevices: async () => [drawer],
    hardware: null,
    async reportResult(result) {
      reported.push(result);
    },
  });
  assert.equal(missingBridge.opened, false);
  assert.match(missingBridge.opened ? "" : missingBridge.message, /POS 硬件桥/);
  assert.equal(reported[0]?.status, "failed");

  console.log("POS cash-drawer client smoke passed.");
}

void runCashDrawerSmoke().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
