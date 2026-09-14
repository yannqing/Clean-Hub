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

console.log("POS order financial smoke passed.");
