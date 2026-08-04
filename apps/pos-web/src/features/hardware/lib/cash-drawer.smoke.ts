import assert from "node:assert/strict";

import type {
  PosHardwareDeviceSummary,
  RecordCashPaymentDrawerResultRequest,
} from "@cleanhub/api-client";
import type { PosDrawerOpenRequest } from "@cleanhub/hardware";

import {
  openCashDrawerForPayment,
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
    config: {
      printerId: "receipt-printer",
      pulse: { pin: 1, onTimeMs: 100, offTimeMs: 200 },
    },
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
  assert.match(missingBridge.opened ? "" : missingBridge.message, /Desktop/);
  assert.equal(reported[0]?.status, "failed");

  console.log("POS cash-drawer client smoke passed.");
}

void runCashDrawerSmoke().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
