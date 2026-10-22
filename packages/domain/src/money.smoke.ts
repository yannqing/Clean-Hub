import assert from "node:assert/strict";

import {
  addAmounts,
  amountToCents,
  centsToAmount,
  compareAmounts,
  isPositiveAmount,
  subtractAmounts,
} from "./money.js";

// Parsing and formatting round-trip without losing a cent.
assert.equal(amountToCents("1.03"), BigInt(103));
assert.equal(amountToCents("0.5"), BigInt(50), "one decimal place is padded");
assert.equal(amountToCents("70"), BigInt(7000), "a bare integer is whole units");
assert.equal(amountToCents("-1.03"), BigInt(-103));
assert.equal(centsToAmount(BigInt(103)), "1.03");
assert.equal(centsToAmount(BigInt(7)), "0.07", "cents stay zero-padded");
assert.equal(centsToAmount(BigInt(-103)), "-1.03");
assert.throws(() => amountToCents("1.234"), "a third decimal is not money");
assert.throws(() => amountToCents("abc"), "non-numeric input is rejected");

// The regression this module exists for. As IEEE-754 doubles,
// 0.01 + 0.06 === 0.06999999999999999, which compares as strictly LESS than
// 0.07. A refund ceiling written as `alreadyRefunded + amount > payment.amount`
// therefore reads a fully-exhausted payment as still having headroom, and
// admits one more refund against it.
assert.equal(
  0.01 + 0.06 < 0.07,
  true,
  "float arithmetic really does understate this sum",
);
assert.equal(addAmounts("0.01", "0.06"), "0.07");
assert.equal(
  compareAmounts(addAmounts("0.01", "0.06"), "0.07"),
  0,
  "an exactly-exhausted refund ceiling must compare equal, not less",
);

// Same class of error, further up the scale.
assert.equal(
  0.05 + 0.12 < 0.17,
  true,
  "float arithmetic really does understate this sum",
);
assert.equal(compareAmounts(addAmounts("0.05", "0.12"), "0.17"), 0);

// Ordinary under/over cases still resolve the right way.
assert.equal(
  compareAmounts(addAmounts("29.90", "40.16"), "70.07"),
  -1,
  "a genuinely under-refunded payment still has headroom",
);
assert.equal(
  compareAmounts(addAmounts("29.90", "40.18"), "70.07"),
  1,
  "one cent over the ceiling is rejected",
);

// Ten allocations of 1.00 sum to 9.999999999999998 as floats.
assert.equal(
  Array.from({ length: 10 }).reduce<string>(
    (total) => addAmounts(total, "1.00"),
    "0.00",
  ),
  "10.00",
  "repeated accumulation must not drift",
);

// Subtraction, sign handling and the positive check.
assert.equal(subtractAmounts("70.07", "70.06"), "0.01");
assert.equal(subtractAmounts("1.00", "1.00"), "0.00");
assert.equal(
  subtractAmounts("1.00", "1.50"),
  "-0.50",
  "an over-drawn balance stays negative rather than clamping",
);
assert.equal(isPositiveAmount("0.00"), false);
assert.equal(isPositiveAmount("0.01"), true);
assert.equal(isPositiveAmount("-0.01"), false);

assert.equal(compareAmounts("1.10", "1.9"), -1, "compares by value, not text");

console.log("money smoke tests passed");
