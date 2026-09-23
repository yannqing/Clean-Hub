import { createMemoryStorage } from "@cleanhub/offline";

import {
  readPosOfflineRuntime,
  writePosOfflineRuntime,
} from "./pos-offline-runtime";
import type { PosRuntimeConfig } from "./pos-runtime-config";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const runtime: PosRuntimeConfig = {
  tenantId: "01J00000000000000000000000",
  branchId: "01J00000000000000000000001",
  terminalId: "01J00000000000000000000002",
  userId: "01J00000000000000000000003",
  terminalCredentialVersion: 1,
  currency: "XOF",
  timeZone: "UTC",
  role: "cashier",
  defaultPaymentMethod: "cash",
  paymentMethodsEnabled: ["cash"],
  mobileMoneyProvidersEnabled: [],
  roundingRule: "none",
  cashRoundingStep: 1,
  taxEnabled: false,
  defaultTaxRate: "0.0000",
  pricesIncludeTax: true,
  taxRegistrationNumber: null,
  merchantName: "CleanHub",
  branchName: "Main branch",
  receiptName: null,
  receiptPhone: null,
  receiptAddress: null,
  receiptThankYouMessage: null,
  receiptFields: [],
  ticketLabelFields: [],
  operatorName: "Cashier One",
  terminalName: "Till 1",
  autoPrintReceipt: true,
  printCopies: 1,
  emailReceiptEnabled: false,
};

async function main(): Promise<void> {
  const storage = createMemoryStorage();
  const updatedAt = "2026-09-21T10:00:00.000Z";
  assert(
    await writePosOfflineRuntime(storage, runtime, { updatedAt }),
    "A complete terminal runtime should be cached",
  );
  const cached = await readPosOfflineRuntime(storage, {
    now: Date.parse(updatedAt) + 60_000,
  });
  assert(cached !== null, "Fresh terminal runtime should be readable");
  assert(
    cached.operatorName === null,
    "Offline runtime must not retain a staff display name",
  );
  assert(
    cached.terminalId === runtime.terminalId && cached.userId === runtime.userId,
    "Offline runtime must preserve the terminal queue scope",
  );
  assert(
    (await readPosOfflineRuntime(storage, {
      now: Date.parse(updatedAt) + 8 * 60 * 60 * 1_000 + 1,
    })) === null,
    "Expired runtime must not be used for offline checkout",
  );
  console.log("POS offline runtime smoke ok");
}

void main();
