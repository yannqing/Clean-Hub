import assert from "node:assert/strict";

import {
  createDiscountBodySchema,
  deleteDiscountBodySchema,
  discountListQuerySchema,
  updateDiscountBodySchema,
  updateDiscountStatusBodySchema,
} from "./discounts.validation.js";

const BRANCH_ID = "01KRERJN800000000000000001";
const PRODUCT_ID = "01KRERJN810000000000000002";
const GET_PRODUCT_ID = "01KRERJN820000000000000003";
const CUSTOMER_ID = "01KRERJN830000000000000004";

function validOrderDiscount() {
  return {
    title: "Welcome discount",
    method: "automatic" as const,
    type: "amount_off_order" as const,
    enabled: true,
    valueType: "percentage" as const,
    valueAmount: "10",
    startsAt: "2026-01-01T00:00:00.000Z",
    allBranches: true,
    channels: {
      posEnabled: true,
      customerMobileEnabled: false,
      deliveryEnabled: false,
    },
  };
}

const parsed = createDiscountBodySchema.parse(validOrderDiscount());
assert.equal(parsed.valueAmount, "10");
assert.equal(parsed.currency, null);
assert.deepEqual(parsed.branchIds, []);
assert.deepEqual(parsed.targets, []);

const codeDiscount = createDiscountBodySchema.parse({
  ...validOrderDiscount(),
  title: "Code discount",
  method: "code",
  code: " summer-10 ",
});
assert.equal(codeDiscount.code, "SUMMER-10");

assert.equal(
  createDiscountBodySchema.safeParse({
    ...validOrderDiscount(),
    method: "code",
  }).success,
  false,
  "code discounts require a code",
);
assert.equal(
  createDiscountBodySchema.safeParse({
    ...validOrderDiscount(),
    valueAmount: "100.01",
  }).success,
  false,
  "percentages cannot exceed 100",
);
assert.equal(
  createDiscountBodySchema.safeParse({
    ...validOrderDiscount(),
    valueType: "fixed_amount",
    valueAmount: "5.00",
  }).success,
  false,
  "fixed discounts require a currency",
);
assert.equal(
  createDiscountBodySchema.safeParse({
    ...validOrderDiscount(),
    allBranches: false,
  }).success,
  false,
  "scoped discounts require branches",
);

const itemDiscount = createDiscountBodySchema.parse({
  ...validOrderDiscount(),
  type: "amount_off_items",
  allBranches: false,
  branchIds: [BRANCH_ID, BRANCH_ID],
  targets: [
    {
      role: "applies_to",
      targetType: "product",
      targetId: PRODUCT_ID,
    },
  ],
});
assert.deepEqual(itemDiscount.branchIds, [BRANCH_ID]);

assert.equal(
  createDiscountBodySchema.safeParse({
    ...itemDiscount,
    targets: [],
  }).success,
  false,
  "amount-off-items discounts require at least one explicit target",
);
assert.equal(
  createDiscountBodySchema.safeParse({
    ...itemDiscount,
    targets: [
      {
        role: "customer_gets",
        targetType: "product",
        targetId: PRODUCT_ID,
      },
    ],
  }).success,
  false,
  "amount-off-items cannot use buy-X-get-Y target roles",
);

const buyXGetY = createDiscountBodySchema.parse({
  ...validOrderDiscount(),
  type: "buy_x_get_y",
  valueType: "free",
  valueAmount: null,
  buyRequirementType: "minimum_quantity",
  buyRequirementValue: "2",
  getQuantity: "1",
  targets: [
    {
      role: "customer_buys",
      targetType: "product",
      targetId: PRODUCT_ID,
    },
    {
      role: "customer_gets",
      targetType: "product",
      targetId: GET_PRODUCT_ID,
    },
  ],
});
assert.equal(buyXGetY.valueType, "free");

const shipping = createDiscountBodySchema.parse({
  ...validOrderDiscount(),
  type: "free_shipping",
  valueType: "free",
  valueAmount: null,
  countryScope: "selected",
  countryCodes: ["cn", "SN", "cn"],
});
assert.deepEqual(shipping.countryCodes, ["CN", "SN"]);

const customerSpecific = createDiscountBodySchema.parse({
  ...validOrderDiscount(),
  eligibility: "specific_customers",
  customerIds: [CUSTOMER_ID],
});
assert.deepEqual(customerSpecific.customerIds, [CUSTOMER_ID]);
assert.equal(
  createDiscountBodySchema.safeParse({
    ...validOrderDiscount(),
    eligibility: "specific_customers",
  }).success,
  false,
);

assert.deepEqual(discountListQuerySchema.parse({}), {
  sort: "created_desc",
  limit: 10,
  offset: 0,
});
assert.equal(
  updateDiscountBodySchema.safeParse({ title: "Changed", version: 2 }).success,
  true,
);
assert.equal(
  updateDiscountBodySchema.safeParse({
    type: "free_shipping",
    version: 2,
  }).success,
  false,
  "discount type is immutable after creation",
);
assert.equal(updateDiscountBodySchema.safeParse({ version: 2 }).success, false);
assert.deepEqual(
  updateDiscountStatusBodySchema.parse({
    enabled: false,
    version: 1,
  }),
  {
    enabled: false,
    version: 1,
  },
);
assert.deepEqual(deleteDiscountBodySchema.parse({ version: 1 }), {
  version: 1,
});

console.log("Tenant discounts validation smoke passed.");
