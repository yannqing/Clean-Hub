import assert from "node:assert/strict";

import type { PersistentPrintJob } from "@cleanhub/offline";

import {
  executePosPrintJob,
  resolveConfiguredPrinterId,
  type PosPrintJobPayload,
} from "./pos-print-job";

function job(
  printerId?: string,
  documentType: PosPrintJobPayload["documentType"] = "receipt",
): PersistentPrintJob<PosPrintJobPayload> {
  const now = new Date(0).toISOString();
  return {
    id: "01TEST00000000000000000001",
    idempotencyKey: "print-test",
    payload: {
      documentType,
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
  const devices = [
    {
      id: "01TEST00000000000000000010",
      tenantId: "01TEST00000000000000000011",
      terminalId: "01TEST00000000000000000012",
      name: "Receipt printer",
      deviceType: "printer" as const,
      connectionType: "usb" as const,
      config: { printerId: "default", printerPurpose: "receipt" },
      status: "active" as const,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      version: 1,
    },
    {
      id: "01TEST00000000000000000013",
      tenantId: "01TEST00000000000000000011",
      terminalId: "01TEST00000000000000000012",
      name: "Laundry label printer",
      deviceType: "printer" as const,
      connectionType: "usb" as const,
      config: { printerId: "bound", printerPurpose: "label" },
      status: "active" as const,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      version: 1,
    },
  ];

  assert.equal(resolveConfiguredPrinterId(devices, "receipt"), "default");
  assert.equal(resolveConfiguredPrinterId(devices, "label"), "bound");

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

  await assert.rejects(
    () => executePosPrintJob(job(undefined, "label"), hardware),
    /\u6807\u7b7e\u4efb\u52a1\u7f3a\u5c11\u6807\u7b7e\u6253\u5370\u673a\u8def\u7531/,
  );

  await executePosPrintJob(job("bound", "label"), hardware);
  assert.deepEqual(printedWith, ["bound", "default", "bound"]);

  console.log("POS print job smoke passed.");
}

void main();
