import assert from "node:assert/strict";

import { orderTaxBreakdown } from "./tax.breakdown.js";

const line = (taxRateSnapshot: string, taxableAmount: string, taxAmount: string) => ({
  taxRateSnapshot,
  taxableAmount,
  taxAmount,
});

// Mixed basket: 12,000 at 18% (1,800 + 360) and 5,000 exempt.
assert.deepEqual(
  orderTaxBreakdown(line("0.1800", "17000.00", "2160.00"), [
    line("0.1800", "10000.00", "1800.00"),
    line("0.0000", "5000.00", "0.00"),
    line("0.18", "2000.00", "360.00"),
  ]),
  [
    { taxRate: "0.1800", taxableAmount: "12000.00", taxAmount: "2160.00" },
    { taxRate: "0.0000", taxableAmount: "5000.00", taxAmount: "0.00" },
  ],
);

// Lines that do not sum to the order (priced before per-line tax) fall back
// to the order's own single rate instead of contradicting its total.
assert.deepEqual(
  orderTaxBreakdown(line("0.1800", "10000.00", "1800.00"), [
    line("0.0000", "0.00", "0.00"),
  ]),
  [{ taxRate: "0.1800", taxableAmount: "10000.00", taxAmount: "1800.00" }],
);

// An order with no lines, or with nothing taxable, still reports one entry.
assert.equal(orderTaxBreakdown(line("0.0000", "0.00", "0.00"), []).length, 1);
assert.deepEqual(
  orderTaxBreakdown(line("0.0000", "0.00", "0.00"), [line("0.0000", "0.00", "0.00")]),
  [{ taxRate: "0.0000", taxableAmount: "0.00", taxAmount: "0.00" }],
);

console.log("Order tax breakdown smoke passed.");
