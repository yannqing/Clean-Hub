import assert from "node:assert/strict";

import type { PersistentPrintJob } from "@cleanhub/offline";

import {
  executePosPrintJob,
  type PosPrintJobPayload,
} from "./pos-print-job";

function job(printerId?: string): PersistentPrintJob<PosPrintJobPayload> {
  const now = new Date(0).toISOString();
  return {
    id: "01TEST00000000000000000001",
    idempotencyKey: "print-test",
    payload: {
      documentType: "receipt",
      entityId: "01TEST00000000000000000002",
      title: "Test",
      content: "Test receipt",
      printerId,
    },
    status: "pending",
    attempt: 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function main(): Promise<void> {
const printedWith: string[] = [];
const hardware = {
  async getCapabilities() {
    return {
      scanner: false,
      printer: true,
      cashDrawer: false,
      cardTerminal: false,
      secureTerminalCredential: false,
    };
  },
  async listPrinters() {
    return [
      { id: "default", name: "Default", isDefault: true },
      { id: "bound", name: "Bound", isDefault: false },
    ];
  },
  async print(request: { id: string; printerId: string }) {
    printedWith.push(request.printerId);
    return { jobId: request.id, status: "printed" as const };
  },
};

await executePosPrintJob(job("bound"), hardware);
assert.deepEqual(printedWith, ["bound"]);

await assert.rejects(
  () => executePosPrintJob(job("missing"), hardware),
  /\u5df2\u7ed1\u5b9a\u7684\u6253\u5370\u673a\u672a\u88ab\u5f53\u524d\u8bbe\u5907\u68c0\u6d4b\u5230/,
);
assert.deepEqual(printedWith, ["bound"]);

await executePosPrintJob(job(), hardware);
assert.deepEqual(printedWith, ["bound", "default"]);

console.log("POS print job smoke passed.");
}

void main();
