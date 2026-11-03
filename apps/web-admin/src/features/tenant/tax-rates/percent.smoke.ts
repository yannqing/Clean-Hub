import assert from "node:assert/strict";

import { formatTaxRatePercent, fractionToPercent, percentToFraction } from "./percent";

// Exact where float division is not: 7.35 / 100 is 0.07350000000000001 in
// floating point, which the API rejects as more than four decimals.
assert.equal(percentToFraction("7.35"), "0.0735");
assert.equal(percentToFraction("18"), "0.1800");
assert.equal(percentToFraction("18.5"), "0.1850");
assert.equal(percentToFraction("0"), "0.0000");
assert.equal(percentToFraction("100"), "1.0000");
assert.equal(percentToFraction(" 9 "), "0.0900");
for (const invalid of ["", "-1", "100.01", "101", "18.555", "abc", "1e2", "18%"]) {
  assert.equal(percentToFraction(invalid), null, `"${invalid}" must be rejected`);
}

assert.equal(fractionToPercent("0.1800"), "18");
assert.equal(fractionToPercent("0.0735"), "7.35");
assert.equal(fractionToPercent("0.0750"), "7.5");
assert.equal(fractionToPercent("0.0000"), "0");
assert.equal(fractionToPercent("1.0000"), "100");
assert.equal(formatTaxRatePercent("0.1800"), "18%");

// Every two-decimal percent survives the round trip unchanged.
for (let hundredths = 0; hundredths <= 10_000; hundredths += 1) {
  const percent = fractionToPercent(`${Math.floor(hundredths / 10_000)}.${String(hundredths % 10_000).padStart(4, "0")}`);
  const fraction = percentToFraction(percent);
  assert.ok(fraction, `${percent} must parse`);
  assert.equal(fractionToPercent(fraction), percent);
}

console.log("Tax rate percent smoke passed.");
