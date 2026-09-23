import assert from "node:assert/strict";

import type { PosCartProductLine, PosCartSnapshot } from "../cart.types";
import { calculateLocalCartPricing, type LocalPricingRules } from "./local-pricing";

function productLine(
  id: string,
  unitAmount: string,
  quantity: number,
  taxRate?: string | null,
): PosCartProductLine {
  return {
    id: `product:${id}`,
    kind: "product",
    productSkuId: id,
    name: id,
    sku: id,
    barcode: null,
    variantName: null,
    unitOfMeasure: "piece",
    unitAmount,
    currency: "XOF",
    quantity,
    trackInventory: false,
    availableQuantity: null,
    allowNegativeStock: false,
    allowOfflineSale: true,
    offlineStockBuffer: "0",
    coverUrl: null,
    ...(taxRate === undefined ? {} : { taxRate }),
  };
}

function cart(lines: PosCartProductLine[]): PosCartSnapshot {
  return {
    version: 2,
    checkoutId: "01KTESTCHECKOUT00000000000",
    currency: "XOF",
    customer: null,
    lines,
    notes: "",
    discountCode: "",
    discountReason: "",
    updatedAt: "2026-09-23T00:00:00.000Z",
  };
}

const senegal: LocalPricingRules = {
  currency: "XOF",
  taxEnabled: true,
  defaultTaxRate: "0.1800",
  pricesIncludeTax: false,
  roundingRule: "none",
};

// 10,000 standard-rated, 5,000 exempt, 2,000 on the default: 1,800 + 0 + 360.
const mixed = calculateLocalCartPricing(
  cart([
    productLine("shirt", "10000.00", 1, "0.1800"),
    productLine("uniform", "5000.00", 1, "0.0000"),
    productLine("trousers", "1000.00", 2, null),
  ]),
  senegal,
);
assert.equal(mixed.subtotalAmount, "17000.00");
assert.equal(mixed.taxAmount, "2160.00");
assert.equal(mixed.totalAmount, "19160.00");
assert.deepEqual(
  mixed.taxBreakdown.map((entry) => [entry.taxRate, entry.taxAmount]),
  [
    ["0.1800", "2160.00"],
    ["0.0000", "0.00"],
  ],
  "one line per rate, the default rate grouped with the explicit 18%",
);

// A cart saved before per-item tax has no taxRate field: it prices at the
// default, exactly as it did when it was saved.
const legacy = calculateLocalCartPricing(
  cart([productLine("legacy", "10000.00", 1)]),
  senegal,
);
assert.equal(legacy.taxAmount, "1800.00");

// Prices that include tax: 11,800 at 18% holds 1,800; the total does not move.
const inclusive = calculateLocalCartPricing(
  cart([productLine("inclusive", "11800.00", 1, "0.1800")]),
  { ...senegal, pricesIncludeTax: true },
);
assert.equal(inclusive.taxAmount, "1800.00");
assert.equal(inclusive.totalAmount, "11800.00");

// XOF has no sub-franc coin: 18% of 333 is 59.94, so the total is rounded to
// a whole franc and the adjustment recorded.
const rounded = calculateLocalCartPricing(
  cart([productLine("odd", "333.00", 1, "0.1800")]),
  senegal,
);
assert.equal(rounded.taxAmount, "59.94");
assert.equal(rounded.totalAmount, "393.00");
assert.equal(rounded.roundingAdjustmentAmount, "0.06");

// VAT off: no tax whatever the item carries.
const untaxed = calculateLocalCartPricing(
  cart([productLine("shirt", "10000.00", 1, "0.1800")]),
  { ...senegal, taxEnabled: false },
);
assert.equal(untaxed.taxAmount, "0.00");
assert.equal(untaxed.totalAmount, "10000.00");

// The previous single-rate formula ran in floating point. For every rate and
// a spread of amounts, the grouped calculation must give the same total as
// the exact single-rate formula when all lines share one rate.
for (const rate of ["0.1800", "0.0900", "0.0000", "0.0333"]) {
  for (const unit of ["1.00", "7.50", "99.99", "333.00", "12345.67"]) {
    const scaled = BigInt(Math.round(Number(rate) * 10_000));
    const subtotal = BigInt(Math.round(Number(unit) * 100)) * BigInt(3);
    const tax =
      scaled === BigInt(0)
        ? BigInt(0)
        : (subtotal * scaled + BigInt(5_000)) / BigInt(10_000);
    const result = calculateLocalCartPricing(
      cart([
        productLine("a", unit, 1, rate),
        productLine("b", unit, 2, rate),
      ]),
      { ...senegal, currency: "EUR" },
    );
    assert.equal(
      result.taxAmount,
      `${tax / BigInt(100)}.${(tax % BigInt(100)).toString().padStart(2, "0")}`,
      `${unit} x3 at ${rate}`,
    );
  }
}

console.log("POS local pricing smoke passed.");
