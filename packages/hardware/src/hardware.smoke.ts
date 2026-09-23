import {
  buildPosReceiptEscPos,
  buildPosReceiptText,
  buildEscPosCashDrawerPulse,
  createEscPosPrinterCashDrawerAdapter,
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
assert(
  !capabilities.secureTerminalCredential,
  "secure storage must be unavailable",
);
assert(
  (await runtime.listPrinters()).length === 0,
  "printer list must be empty",
);
assert(
  (await runtime.print({ id: "print_1", printerId: "missing", content: "x" }))
    .status === "failed",
  "unavailable printer must return a failed job",
);
await expectReject(
  runtime.openCashDrawer({
    reason: "Manager approved",
    trigger: { type: "manual", authorizationId: "authorization_1" },
  }),
  (error) =>
    error instanceof PosHardwareUnavailableError &&
    error.capability === "cashDrawer" &&
    error.code === "POS_HARDWARE_UNAVAILABLE",
  "unknown cash drawer must reject as unavailable",
);
await expectReject(
  runtime.openCashDrawer({
    reason: " ",
    trigger: { type: "manual", authorizationId: "authorization_1" },
  }),
  (error) =>
    error instanceof Error && /reason is required/i.test(error.message),
  "cash drawer reason must be required",
);

const rawWrites: Array<{ printerId: string; bytes: Uint8Array }> = [];
const drawerAdapter = createEscPosPrinterCashDrawerAdapter({
  isSupported: () => true,
  async listPrinters() {
    return [
      { id: "backup", name: "Backup", isDefault: false },
      { id: "receipt", name: "Receipt", isDefault: true },
    ];
  },
  async writeRaw(request) {
    rawWrites.push(request);
  },
});
assert(await drawerAdapter.isAvailable(), "ESC/POS drawer must be available");
await drawerAdapter.open({
  reason: "Cash payment payment_1",
  printerId: "backup",
  pulse: { pin: 1, onTimeMs: 100, offTimeMs: 200 },
  trigger: { type: "cash_payment", paymentId: "payment_1" },
});
assert(rawWrites[0]?.printerId === "backup", "configured printer must win");
assert(
  Array.from(rawWrites[0]?.bytes ?? []).join(",") === "27,112,1,50,100",
  "ESC/POS drawer pulse must preserve pin and timing",
);
assert(
  Array.from(buildEscPosCashDrawerPulse()).join(",") === "27,112,0,60,120",
  "ESC/POS drawer pulse must have safe defaults",
);
await expectReject(
  drawerAdapter.open({
    reason: "Cash payment payment_2",
    printerId: "missing",
    trigger: { type: "cash_payment", paymentId: "payment_2" },
  }),
  (error) =>
    error instanceof PosHardwareUnavailableError &&
    /printer was not found/i.test(error.message),
  "a configured missing printer must fail rather than silently switching printers",
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

// A basket of standard-rated and exempt items prints tax per rate, as a VAT
// receipt must, and never a float such as "VAT 7.000000000000001%".
const mixedRateText = buildPosReceiptText(
  {
    ...receipt,
    fields: undefined,
    taxRate: "0.0700",
    taxBreakdown: [
      { taxRate: "0.1800", taxableMinor: 1_200_000, taxMinor: 216_000 },
      { taxRate: "0.0000", taxableMinor: 500_000, taxMinor: 0 },
    ],
  },
  { locale: "fr" },
);
assert(mixedRateText.includes("TVA 18%"), "each rate is labelled with its percentage");
assert(mixedRateText.includes("TVA 0%"), "the exempt base is shown too");
assert(!mixedRateText.includes("0000000"), "rates never print as floats");
const singleRateText = buildPosReceiptText(
  { ...receipt, fields: undefined, taxRate: "0.0700", taxMinor: 700, taxBreakdown: undefined },
  { locale: "en" },
);
assert(singleRateText.includes("VAT 7%"), `single rate prints exactly, got:\n${singleRateText}`);

console.log("hardware smoke ok");
