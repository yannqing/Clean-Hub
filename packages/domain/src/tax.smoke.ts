import assert from "node:assert/strict";

import {
  allocateProportionally,
  calculateTaxedTotals,
  formatTaxRatePercent,
  normalizeTaxRate,
  TAX_RATE_SCALE,
  taxRateToScale,
} from "./tax";

const b = (value: number) => BigInt(value);

function totals(
  lines: Array<[number, string]>,
  options: {
    discount?: number;
    inclusive?: boolean;
    taxEnabled?: boolean;
    exemption?: string | null;
  } = {},
) {
  return calculateTaxedTotals({
    lines: lines.map(([gross, taxRate], index) => ({
      key: `l${index}`,
      grossMinor: b(gross),
      taxRate,
    })),
    discountMinor: b(options.discount ?? 0),
    taxEnabled: options.taxEnabled ?? true,
    pricesIncludeTax: options.inclusive ?? false,
    exemption: options.exemption ?? null,
  });
}

// --- the single-rate case must be exactly the order-level formula it replaces
function legacySingleRate(
  subtotal: bigint,
  discount: bigint,
  rate: string,
  inclusive: boolean,
) {
  const base = subtotal - (discount > subtotal ? subtotal : discount);
  const scaled = taxRateToScale(rate);
  const round = (n: bigint, d: bigint) => (n + d / b(2)) / d;
  const tax =
    scaled === b(0)
      ? b(0)
      : inclusive
        ? round(base * scaled, TAX_RATE_SCALE + scaled)
        : round(base * scaled, TAX_RATE_SCALE);
  return { tax, taxable: inclusive ? base - tax : base };
}

let compared = 0;
for (const subtotal of [0, 1, 7, 99, 100, 333, 5225, 9999, 1_000_000, 1_180_000]) {
  for (const discount of [0, 1, 50, 275, 999]) {
    for (const rate of ["0.0000", "0.1800", "0.0900", "0.0333", "0.2000"]) {
      for (const inclusive of [true, false]) {
        // Split the same subtotal across several lines of the same rate: the
        // result must not depend on how the basket is itemised.
        const third = Math.floor(subtotal / 3);
        const result = totals(
          [
            [third, rate],
            [third, rate],
            [subtotal - 2 * third, rate],
          ],
          { discount, inclusive },
        );
        const legacy = legacySingleRate(b(subtotal), b(discount), rate, inclusive);
        assert.equal(result.taxMinor, legacy.tax, `tax ${subtotal}/${discount}/${rate}/${inclusive}`);
        assert.equal(result.taxableMinor, legacy.taxable);
        compared += 1;
      }
    }
  }
}
assert.equal(compared, 10 * 5 * 5 * 2, "every single-rate case must be compared");

// --- mixed rates, stated as the amounts a customer and inspector expect
// 10,000 standard-rated at 18% and 5,000 exempt, tax-exclusive.
const mixed = totals([
  [1_000_000, "0.1800"],
  [500_000, "0.0000"],
]);
assert.equal(mixed.taxMinor, b(180_000), "only the standard-rated line is taxed");
assert.equal(mixed.taxableMinor, b(1_500_000));
assert.equal(mixed.groups.length, 2);
assert.equal(mixed.groups[0]!.taxRate, "0.1800", "largest base first");
assert.equal(mixed.groups[1]!.taxMinor, b(0));

// Tax-inclusive: 11,800 at 18% holds 1,800; the exempt 5,000 holds nothing.
const mixedInclusive = totals(
  [
    [1_180_000, "0.1800"],
    [500_000, "0.0000"],
  ],
  { inclusive: true },
);
assert.equal(mixedInclusive.taxMinor, b(180_000));
assert.equal(mixedInclusive.taxableMinor, b(1_500_000));

// Three rates, as in Côte d'Ivoire: 18%, 9% and exempt.
const ivorian = totals([
  [1_000_000, "0.1800"],
  [1_000_000, "0.0900"],
  [1_000_000, "0.0000"],
]);
assert.equal(ivorian.taxMinor, b(270_000), "1,800 + 900 + 0");

// An order discount comes off every line in proportion, then tax is taken:
// 10,000 @18% and 10,000 exempt with 2,000 off leaves 9,000 in each.
const discounted = totals(
  [
    [1_000_000, "0.1800"],
    [1_000_000, "0.0000"],
  ],
  { discount: 200_000 },
);
assert.equal(discounted.taxMinor, b(162_000), "18% of 9,000");
assert.equal(discounted.lines[0]!.discountMinor, b(100_000));
assert.equal(discounted.lines[1]!.discountMinor, b(100_000));

// Tax disabled or an exemption zeroes every group whatever its rate.
assert.equal(totals([[1_000_000, "0.1800"]], { taxEnabled: false }).taxMinor, b(0));
assert.equal(totals([[1_000_000, "0.1800"]], { exemption: "Embassy" }).taxMinor, b(0));
assert.equal(
  totals([[1_000_000, "0.1800"]], { exemption: "Embassy" }).lines[0]!.taxRate,
  "0.0000",
  "an exempted line records a zero rate, not the one it would have had",
);

// Rates written differently are the same group.
assert.equal(normalizeTaxRate("0.18"), "0.1800");
assert.equal(normalizeTaxRate("0.1800"), "0.1800");
assert.equal(normalizeTaxRate("0"), "0.0000");
assert.equal(normalizeTaxRate("1"), "1.0000");
assert.equal(totals([[100, "0.18"], [100, "0.1800"]]).groups.length, 1);

// --- allocation always sums exactly and is deterministic
assert.deepEqual(allocateProportionally(b(10), [b(1), b(1), b(1)]), [b(4), b(3), b(3)]);
assert.deepEqual(allocateProportionally(b(0), [b(5), b(5)]), [b(0), b(0)]);
assert.deepEqual(allocateProportionally(b(7), [b(0), b(0)]), [b(7), b(0)]);
assert.deepEqual(allocateProportionally(b(5), []), []);

// Property: across many awkward baskets, lines sum to groups and groups to
// the order, to the unit. A mismatch here is a receipt whose column does not
// add up to its total.
let seed = 42;
const random = (max: number) => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
  return seed % max;
};
const rates = ["0.1800", "0.0900", "0.0000", "0.0333", "0.2000"];
for (let trial = 0; trial < 500; trial += 1) {
  const lineCount = 1 + random(8);
  const basket: Array<[number, string]> = [];
  for (let index = 0; index < lineCount; index += 1) {
    basket.push([random(250_000), rates[random(rates.length)]!]);
  }
  const subtotal = basket.reduce((sum, [gross]) => sum + gross, 0);
  const result = totals(basket, {
    discount: random(subtotal + 1),
    inclusive: random(2) === 0,
  });
  const lineTax = result.lines.reduce((sum, line) => sum + line.taxMinor, b(0));
  const lineTaxable = result.lines.reduce((sum, line) => sum + line.taxableMinor, b(0));
  const groupTax = result.groups.reduce((sum, group) => sum + group.taxMinor, b(0));
  assert.equal(lineTax, result.taxMinor, `trial ${trial}: lines sum to the order tax`);
  assert.equal(lineTaxable, result.taxableMinor, `trial ${trial}: taxable sums`);
  assert.equal(groupTax, result.taxMinor, `trial ${trial}: groups sum to the order tax`);
  for (const line of result.lines) {
    assert.ok(line.taxMinor >= b(0) && line.taxableMinor >= b(0), `trial ${trial}: no negative line`);
  }
}

// A discount the engine attributed to the exempt line must not lower the tax
// on the standard-rated one. Spread evenly, 2,000 off would have cut the taxed
// base to 9,000; attributed, the taxed line keeps its full 10,000.
const targeted = calculateTaxedTotals({
  lines: [
    { key: "shirt", grossMinor: b(1_000_000), taxRate: "0.1800" },
    { key: "exempt", grossMinor: b(1_000_000), taxRate: "0.0000", discountMinor: b(200_000) },
  ],
  discountMinor: b(200_000),
  taxEnabled: true,
  pricesIncludeTax: false,
  exemption: null,
});
assert.equal(targeted.taxMinor, b(180_000), "the taxed line keeps its whole base");
assert.equal(targeted.lines[1]!.discountMinor, b(200_000));
assert.equal(targeted.lines[0]!.discountMinor, b(0));

// Attributions that exceed the order discount are scaled back, never trusted
// past the total -- the order cannot be discounted by more than it was.
const overAttributed = calculateTaxedTotals({
  lines: [
    { key: "a", grossMinor: b(1_000), taxRate: "0.1800", discountMinor: b(800) },
    { key: "b", grossMinor: b(1_000), taxRate: "0.1800", discountMinor: b(800) },
  ],
  discountMinor: b(1_000),
  taxEnabled: true,
  pricesIncludeTax: false,
  exemption: null,
});
assert.equal(
  overAttributed.lines.reduce((sum, line) => sum + line.discountMinor, b(0)),
  b(1_000),
);
assert.equal(overAttributed.baseMinor, b(1_000));

assert.equal(formatTaxRatePercent("0.1800"), "18%");
assert.equal(formatTaxRatePercent("0.0700"), "7%", "not 7.000000000000001%");
assert.equal(formatTaxRatePercent("0.0750"), "7.5%");
assert.equal(formatTaxRatePercent("0.0735"), "7.35%");
assert.equal(formatTaxRatePercent("0.0000"), "0%");
assert.equal(formatTaxRatePercent("1.0000"), "100%");

console.log("Tax calculation smoke passed.");
