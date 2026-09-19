import assert from "node:assert/strict";

import {
  allocateReceiptLineMinor,
  CASH_ROUNDING_STEPS,
  cashRoundingStepToMinor,
  getCurrencyMinorUnits,
  getCurrencyPayableStep,
  isCashRoundingStep,
  moneyToReceiptMinor,
  roundCashDown,
  roundToPayableAmount,
  roundToStep,
} from "./currency.js";

// XOF has no sub-franc coin; EUR-style currencies keep two decimals.
assert.equal(getCurrencyMinorUnits("XOF"), 0);
assert.equal(getCurrencyMinorUnits("xof"), 0, "currency codes are case-insensitive");
assert.equal(getCurrencyMinorUnits("JPY"), 0);
assert.equal(getCurrencyMinorUnits("CNY"), 2);
assert.equal(getCurrencyMinorUnits("EUR"), 2);
assert.equal(
  getCurrencyMinorUnits(undefined),
  2,
  "an unknown currency must not silently lose precision",
);

// Storage is always hundredths, so a zero-decimal currency steps by 100.
assert.equal(getCurrencyPayableStep("XOF"), BigInt(100));
assert.equal(getCurrencyPayableStep("CNY"), BigInt(1));

// The bug this guards: 52.25 XOF is not payable and must land on a whole franc.
assert.equal(
  roundToPayableAmount(BigInt(5225), "XOF"),
  BigInt(5200),
  "a fractional franc total must round to a payable amount",
);
assert.equal(
  roundToPayableAmount(BigInt(5250), "XOF"),
  BigInt(5300),
  "half rounds up",
);
assert.equal(
  roundToPayableAmount(BigInt(5225), "CNY"),
  BigInt(5225),
  "a two-decimal currency keeps its cents",
);

assert.equal(roundToStep(BigInt(5225), BigInt(1)), BigInt(5225));
assert.equal(roundToStep(BigInt(5225), BigInt(500)), BigInt(5000));

// Cash rounding is a concession: it may never ask for more than the order.
assert.equal(
  roundCashDown(BigInt(5200), BigInt(500)),
  BigInt(5000),
  "52 F CFA rounds down to 50 when the till has no coin under 5",
);
assert.equal(
  roundCashDown(BigInt(5300), BigInt(500)),
  BigInt(5000),
  "cash rounding never rounds up against the customer",
);
assert.equal(roundCashDown(BigInt(5000), BigInt(500)), BigInt(5000));
assert.equal(
  roundCashDown(BigInt(300), BigInt(500)),
  BigInt(0),
  "an amount below one note rounds to zero rather than going negative",
);
assert.equal(roundCashDown(BigInt(5225), BigInt(1)), BigInt(5225));

// A 5 F CFA note is 500 storage units; disabled steps are a no-op.
assert.equal(cashRoundingStepToMinor(5), BigInt(500));
assert.equal(cashRoundingStepToMinor(1), BigInt(1));
assert.equal(cashRoundingStepToMinor(0), BigInt(1));
assert.equal(cashRoundingStepToMinor(null), BigInt(1));
assert.equal(
  cashRoundingStepToMinor(5),
  BigInt(500),
  "the step counts whole notes, so it scales by storage precision",
);

// A 52 F CFA total with a 5-franc till: the customer pays 50, never 55.
assert.equal(
  roundCashDown(roundToPayableAmount(BigInt(5225), "XOF"), cashRoundingStepToMinor(5)),
  BigInt(5000),
  "pricing rounds to a payable franc, then cash rounding concedes down to a note",
);

// The cashier picks a denomination from a fixed list, never a free amount:
// this bound is what keeps the concession a rounding step rather than an
// unaudited discount.
assert.equal(isCashRoundingStep(5), true);
assert.equal(isCashRoundingStep(1), true, "1 is offered and means no rounding");
assert.equal(isCashRoundingStep(100), true);
assert.equal(isCashRoundingStep(7), false, "an off-list note must be refused");
assert.equal(isCashRoundingStep(3000), false, "a large write-off is not a step");
assert.equal(isCashRoundingStep(0), false);
assert.equal(isCashRoundingStep(-5), false);
assert.equal(isCashRoundingStep(null), false);
assert.equal(isCashRoundingStep(undefined), false);
assert.equal(
  CASH_ROUNDING_STEPS.every((step) => cashRoundingStepToMinor(step) > BigInt(0)),
  true,
  "every offered step converts to a usable minor-unit step",
);

// Receipts print in the currency's own minor units, so a stored "52.25" is 52
// francs but 5225 cents. Deriving this from `Intl` per call site is what
// printed a 52.25 order as 52.
assert.equal(moneyToReceiptMinor("52.25", "XOF"), 52);
assert.equal(moneyToReceiptMinor("52.25", "EUR"), 5225);
assert.equal(moneyToReceiptMinor("1000.00", "XOF"), 1000);
assert.equal(moneyToReceiptMinor("0.50", "XOF"), 1, "half a franc rounds up");
assert.equal(moneyToReceiptMinor(null, "XOF"), 0);
assert.equal(moneyToReceiptMinor("not-money", "EUR"), 0);

// A receipt whose lines do not add up to its total is the bug this guards.
// Rounding each line alone turns three 0.40 lines under a 1.20 total into
// 0 + 0 + 0, and four 12.50 lines under a 50.00 total into 52.
for (const [lines, total] of [
  [["12.50", "12.50", "12.50", "12.50"], "50.00"],
  [["0.40", "0.40", "0.40"], "1.20"],
  [["2.25", "2.25", "2.25", "2.25"], "9.00"],
  [["0.10", "0.10", "0.10", "0.10", "0.10"], "0.50"],
] as const) {
  const totalMinor = moneyToReceiptMinor(total, "XOF");
  const allocated = allocateReceiptLineMinor(lines, "XOF", totalMinor);
  assert.equal(
    allocated.reduce((sum, value) => sum + value, 0),
    totalMinor,
    `XOF lines ${lines.join("+")} must sum to the printed total`,
  );
  // No line may drift more than a single franc from its true value.
  for (const [index, value] of allocated.entries()) {
    assert.ok(
      Math.abs(value - moneyToReceiptMinor(lines[index], "XOF")) <= 1,
      "allocation must stay within one minor unit of the line amount",
    );
  }
}

// A currency already at storage scale is exact, so allocation leaves it alone
// rather than nudging lines to match a total they genuinely do not sum to.
assert.deepEqual(
  allocateReceiptLineMinor(["12.50", "12.50"], "EUR", 2500),
  [1250, 1250],
);
assert.deepEqual(
  allocateReceiptLineMinor(["1.00", "2.00"], "EUR", 9999),
  [100, 200],
  "an inconsistent total must not be papered over at storage scale",
);
assert.deepEqual(allocateReceiptLineMinor([], "XOF", 0), []);

console.log("currency smoke passed.");
