import assert from "node:assert/strict";

import {
  CASH_ROUNDING_STEPS,
  cashRoundingStepToMinor,
} from "@cleanhub/domain/currency";

import {
  applyCashRoundingToTotals,
  calculatePosFinancialTotals,
  type PosFinancialRules,
} from "./orders.financial.js";

const noTax: Omit<PosFinancialRules, "currency"> = {
  roundingRule: "none",
  taxEnabled: false,
  taxRate: "0.0000",
  pricesIncludeTax: true,
  taxRegistrationNumber: null,
};

function totalsFor(
  currency: string,
  subtotalMinor: bigint,
  discountMinor: bigint,
  rules: Partial<PosFinancialRules> = {},
) {
  return calculatePosFinancialTotals({
    subtotalMinor,
    discountMinor,
    rules: { ...noTax, currency, ...rules },
  });
}

// The bug that started this: a 5% discount on 55 F CFA produced 52.25, an
// amount with no coin behind it. XOF totals must land on a whole franc.
const xof = totalsFor("XOF", BigInt(5500), BigInt(275));
assert.equal(
  xof.totalMinor,
  BigInt(5200),
  "a fractional franc total must round to a payable amount",
);
assert.equal(
  xof.roundingAdjustmentMinor,
  BigInt(-25),
  "the rounded-away fraction must be recorded, not silently dropped",
);

// A two-decimal currency keeps its cents: the floor is per currency.
const cny = totalsFor("CNY", BigInt(5500), BigInt(275));
assert.equal(cny.totalMinor, BigInt(5225));
assert.equal(cny.roundingAdjustmentMinor, BigInt(0));

// An unknown currency must not lose precision by guessing.
assert.equal(totalsFor("", BigInt(5225), BigInt(0)).totalMinor, BigInt(5225));

// A configured rule may round more coarsely than the currency, never finer.
assert.equal(
  totalsFor("XOF", BigInt(5225), BigInt(0), { roundingRule: "round_yuan" })
    .totalMinor,
  BigInt(5200),
  "a coarser configured rule still lands on a payable amount",
);
assert.equal(
  totalsFor("CNY", BigInt(5225), BigInt(0), { roundingRule: "round_jiao" })
    .totalMinor,
  BigInt(5230),
  "a configured rule may round more coarsely than the currency",
);

// Cash rounding is the cashier's concession: down to the till's note, and the
// shortfall is folded into the same audited adjustment.
const conceded = applyCashRoundingToTotals(xof, BigInt(500));
assert.equal(
  conceded.totalMinor,
  BigInt(5000),
  "52 F CFA rounds down to 50 when the till has no coin under 5",
);
assert.equal(
  conceded.roundingAdjustmentMinor,
  BigInt(-225),
  "the concession accumulates onto the currency rounding already applied",
);
assert.equal(
  applyCashRoundingToTotals(xof, BigInt(1)),
  xof,
  "a step of one is a no-op and must not churn the adjustment",
);

// Never upward: rounding up would turn a courtesy into a surcharge.
const exact = totalsFor("XOF", BigInt(5300), BigInt(0));
assert.equal(
  applyCashRoundingToTotals(exact, BigInt(500)).totalMinor,
  BigInt(5000),
  "cash rounding must never ask the customer for more than the order",
);

// An order smaller than one note rounds to zero rather than going negative.
const tiny = totalsFor("XOF", BigInt(300), BigInt(0));
assert.equal(applyCashRoundingToTotals(tiny, BigInt(500)).totalMinor, BigInt(0));

// The cashier picks the denomination per sale, so the same total concedes by
// different amounts depending on the step chosen -- and the invariants hold at
// every one of them.
for (const step of CASH_ROUNDING_STEPS) {
  const stepMinor = cashRoundingStepToMinor(step);
  const result = applyCashRoundingToTotals(xof, stepMinor);

  assert.ok(
    result.totalMinor <= xof.totalMinor,
    `step ${step} must never round up against the customer`,
  );
  assert.ok(
    result.totalMinor >= BigInt(0),
    `step ${step} must never drive the total negative`,
  );
  assert.equal(
    result.totalMinor % stepMinor,
    BigInt(0),
    `step ${step} must land on a multiple of the chosen note`,
  );
  // Whatever is conceded stays named in the audited adjustment rather than
  // vanishing from the books.
  assert.equal(
    result.roundingAdjustmentMinor - xof.roundingAdjustmentMinor,
    result.totalMinor - xof.totalMinor,
    `step ${step} must record the concession it granted`,
  );
}

// A coarser choice concedes more: 52 F CFA is 50 at a 5-note, 0 at a 100-note.
assert.equal(
  applyCashRoundingToTotals(xof, cashRoundingStepToMinor(10)).totalMinor,
  BigInt(5000),
  "a 10-franc note leaves 50 on a 52 franc total",
);
assert.equal(
  applyCashRoundingToTotals(xof, cashRoundingStepToMinor(25)).totalMinor,
  BigInt(5000),
  "a 25-franc note leaves 50 on a 52 franc total",
);
assert.equal(
  applyCashRoundingToTotals(xof, cashRoundingStepToMinor(1)),
  xof,
  "choosing 'no rounding' leaves the priced total untouched",
);

// Real tax rates, stated as absolute amounts rather than as agreement with
// another implementation. Every earlier case ran with tax disabled, which is
// how a server reading 0.18 as 0.18% survived: it agreed with the Android till
// that mirrored it, and both were wrong by a factor of a hundred.
//
// Rates are fractions, as the owner's settings form stores them: 0.18 is 18%.
const senegalVat = { taxEnabled: true, taxRate: "0.1800" };

// Tax-exclusive 10,000 F CFA at 18% is 1,800 of tax and 11,800 to pay.
const exclusive = totalsFor("XOF", BigInt(1_000_000), BigInt(0), {
  ...senegalVat,
  pricesIncludeTax: false,
});
assert.equal(exclusive.taxMinor, BigInt(180_000), "18% of 10,000 is 1,800");
assert.equal(exclusive.taxableMinor, BigInt(1_000_000));
assert.equal(exclusive.totalMinor, BigInt(1_180_000));

// Tax-inclusive 11,800 contains the same 1,800: 11,800 x 0.18 / 1.18.
const inclusive = totalsFor("XOF", BigInt(1_180_000), BigInt(0), {
  ...senegalVat,
  pricesIncludeTax: true,
});
assert.equal(inclusive.taxMinor, BigInt(180_000), "11,800 TTC holds 1,800 TVA");
assert.equal(inclusive.taxableMinor, BigInt(1_000_000));
assert.equal(
  inclusive.totalMinor,
  BigInt(1_180_000),
  "an inclusive price is what the customer pays; tax must not be added again",
);

// A discount comes off before tax.
assert.equal(
  totalsFor("XOF", BigInt(1_000_000), BigInt(100_000), {
    ...senegalVat,
    pricesIncludeTax: false,
  }).taxMinor,
  BigInt(162_000),
  "18% of 9,000 after a 1,000 discount is 1,620",
);

// An exemption zeroes the tax whatever the configured rate.
assert.equal(
  calculatePosFinancialTotals({
    subtotalMinor: BigInt(1_000_000),
    discountMinor: BigInt(0),
    rules: { ...noTax, ...senegalVat, currency: "XOF", pricesIncludeTax: false },
    taxExemptionReason: "Embassy",
  }).taxMinor,
  BigInt(0),
);

console.log("POS order financial smoke passed.");
