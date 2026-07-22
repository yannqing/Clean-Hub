import {
  buildPosReceiptEscPos,
  buildPosReceiptText,
  createPosHardwareRuntime,
  createUnavailablePosCashDrawerAdapter,
  createUnavailablePosPrinterAdapter,
  PosHardwareUnavailableError,
} from "./index";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectReject(
  action: Promise<unknown>,
  predicate: (error: unknown) => boolean,
  message: string,
): Promise<void> {
  try {
    await action;
  } catch (error) {
    assert(predicate(error), message);
    return;
  }
  throw new Error(message);
}

const runtime = createPosHardwareRuntime({
  printer: createUnavailablePosPrinterAdapter("Printer unavailable in test."),
  cashDrawer: createUnavailablePosCashDrawerAdapter(
    "Unknown cash drawer is unavailable.",
  ),
  secureTerminalCredential: () => false,
});

const capabilities = await runtime.getCapabilities();
assert(!capabilities.scanner, "scanner must be unavailable");
assert(!capabilities.printer, "printer must be unavailable");
assert(!capabilities.cashDrawer, "cash drawer must be unavailable");
assert(!capabilities.secureTerminalCredential, "secure storage must be unavailable");
assert((await runtime.listPrinters()).length === 0, "printer list must be empty");
assert(
  (await runtime.print({ id: "print_1", printerId: "missing", content: "x" }))
    .status === "failed",
  "unavailable printer must return a failed job",
);
await expectReject(
  runtime.openCashDrawer({ reason: "Manager approved" }),
  (error) =>
    error instanceof PosHardwareUnavailableError &&
    error.capability === "cashDrawer" &&
    error.code === "POS_HARDWARE_UNAVAILABLE",
  "unknown cash drawer must reject as unavailable",
);
await expectReject(
  runtime.openCashDrawer({ reason: " " }),
  (error) => error instanceof Error && /reason is required/i.test(error.message),
  "cash drawer reason must be required",
);

const receipt = {
  receiptNo: "RC-0001",
  orderCode: "OD-12345678",
  issuedAt: "2026-07-22T10:00:00.000Z",
  currency: "XOF",
  merchantName: "CleanHub",
  branchName: "Pilot Branch",
  customerName: "Test Customer",
  items: [
    {
      name: "Shirt cleaning",
      quantity: 2,
      unitAmountMinor: 500,
      totalAmountMinor: 1_000,
    },
  ],
  subtotalMinor: 1_000,
  totalMinor: 1_000,
  paidMinor: 1_000,
  balanceMinor: 0,
};
const receiptText = buildPosReceiptText(receipt, { locale: "en" });
assert(receiptText.includes("RC-0001"), "receipt number should be printable");
assert(receiptText.includes("OD-12345678"), "order code should be printable");
assert(
  receiptText.includes("1,000"),
  "zero-decimal currencies should preserve whole-unit amounts",
);
assert(
  buildPosReceiptEscPos(receipt).byteLength > receiptText.length,
  "ESC/POS receipt should include control bytes",
);

console.log("hardware smoke ok");
