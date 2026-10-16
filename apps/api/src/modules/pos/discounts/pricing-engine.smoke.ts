import assert from "node:assert/strict";

import {
  discountsCanCombine,
  minorToMoney,
  moneyToMinor,
  pricePosDiscount,
  quantityToMillis,
} from "./pricing-engine.js";
import type {
  PosDiscountPricingContext,
  PosDiscountRule,
} from "./discounts.types.js";

const baseRule: PosDiscountRule = {
  id: "01TEST00000000000000000001",
  title: "Test",
  method: "automatic",
  type: "amount_off_order",
  valueType: "percentage",
  valueAmount: "10.00",
  currency: "CNY",
  minimumRequirement: "none",
  minimumPurchaseAmount: null,
  minimumQuantity: null,
  usageLimit: null,
  oncePerCustomer: false,
  combinesWithItemDiscounts: false,
  combinesWithOrderDiscounts: false,
  combinesWithShippingDiscounts: false,
  buyRequirementType: null,
  buyRequirementValue: null,
  getQuantity: null,
  maxUsesPerOrder: null,
  countryScope: "all",
  maximumShippingPrice: null,
  codeId: null,
  code: null,
  targets: [],
  usageCount: 0,
  customerUsageCount: 0,
};

const context: PosDiscountPricingContext = {
  currency: "CNY",
  lines: [
    {
      id: "line-a",
      itemKind: "service",
      lineAmount: "33.33",
      quantity: "1.000",
      weight: null,
      pricingUnit: "per_item",
      serviceId: "service-a",
      serviceCategoryId: "category-a",
      productId: null,
      productCategoryId: null,
    },
    {
      id: "line-b",
      itemKind: "service",
      lineAmount: "66.67",
      quantity: "2.000",
      weight: null,
      pricingUnit: "per_item",
      serviceId: "service-b",
      serviceCategoryId: "category-b",
      productId: null,
      productCategoryId: null,
    },
  ],
};

assert.equal(moneyToMinor("100.05"), BigInt(10_005));
assert.equal(minorToMoney(BigInt(10_005)), "100.05");
assert.equal(quantityToMillis("1.125"), BigInt(1_125));

const percentage = pricePosDiscount(context, baseRule);
assert.equal(percentage?.amountMinor, BigInt(1_000));
assert.deepEqual(
  percentage?.allocations.map((item) => item.amountMinor),
  [BigInt(333), BigInt(667)],
);
const roundedPercentage = pricePosDiscount(
  {
    ...context,
    lines: context.lines.map((line) => ({
      ...line,
      lineAmount: "0.01",
    })),
  },
  { ...baseRule, valueAmount: "50.00" },
);
assert.equal(roundedPercentage?.amountMinor, BigInt(1));

const fixed = pricePosDiscount(context, {
  ...baseRule,
  valueType: "fixed_amount",
  valueAmount: "10.01",
});
// Fixed item/order discounts are a single fixed amount per order, allocated
// proportionally across eligible lines; they are not multiplied per item.
assert.equal(fixed?.amountMinor, BigInt(1_001));
assert.equal(
  fixed?.allocations.reduce((sum, item) => sum + item.amountMinor, BigInt(0)),
  BigInt(1_001),
);

const fixedItems = pricePosDiscount(context, {
  ...baseRule,
  type: "amount_off_items",
  valueType: "fixed_amount",
  valueAmount: "10.01",
  targets: [
    {
      role: "applies_to",
      targetType: "service",
      targetId: "service-a",
    },
    {
      role: "applies_to",
      targetType: "service",
      targetId: "service-b",
    },
  ],
});
assert.equal(fixedItems?.amountMinor, BigInt(1_001));
assert.equal(
  fixedItems?.allocations.reduce(
    (sum, item) => sum + item.amountMinor,
    BigInt(0),
  ),
  BigInt(1_001),
);
assert.equal(
  pricePosDiscount(context, {
    ...baseRule,
    type: "amount_off_items",
  }),
  null,
);

const targeted = pricePosDiscount(context, {
  ...baseRule,
  type: "amount_off_items",
  targets: [
    {
      role: "applies_to",
      targetType: "service",
      targetId: "service-a",
    },
  ],
});
assert.equal(targeted?.amountMinor, BigInt(333));
assert.equal(targeted?.allocations[0]?.orderItemId, "line-a");

const targetedProduct = pricePosDiscount(
  {
    currency: "CNY",
    lines: [
      {
        ...context.lines[0]!,
        id: "product-line",
        itemKind: "product",
        lineAmount: "20.00",
        pricingUnit: null,
        serviceId: null,
        serviceCategoryId: null,
        productId: "product-a",
        productCategoryId: "product-category-a",
      },
    ],
  },
  {
    ...baseRule,
    type: "amount_off_items",
    valueType: "fixed_amount",
    valueAmount: "5.00",
    targets: [
      {
        role: "applies_to",
        targetType: "product",
        targetId: "product-a",
      },
    ],
  },
);
assert.equal(targetedProduct?.amountMinor, BigInt(500));
assert.equal(targetedProduct?.allocations[0]?.orderItemId, "product-line");

const freeShipping = pricePosDiscount(
  {
    ...context,
    lines: [
      ...context.lines,
      {
        ...context.lines[0]!,
        id: "shipping",
        itemKind: "delivery_fee",
        lineAmount: "8.00",
      },
    ],
  },
  {
    ...baseRule,
    type: "free_shipping",
    valueType: "free",
    valueAmount: null,
  },
);
assert.equal(freeShipping?.amountMinor, BigInt(800));
assert.equal(
  pricePosDiscount(
    {
      ...context,
      lines: [
        ...context.lines,
        {
          ...context.lines[0]!,
          id: "selected-country-shipping",
          itemKind: "delivery_fee",
          lineAmount: "8.00",
        },
      ],
    },
    {
      ...baseRule,
      type: "free_shipping",
      valueType: "free",
      valueAmount: null,
      countryScope: "selected",
    },
  ),
  null,
);

const orderDiscountExcludesShipping = pricePosDiscount(
  {
    ...context,
    lines: [
      ...context.lines,
      {
        ...context.lines[0]!,
        id: "shipping-for-order-discount",
        itemKind: "delivery_fee",
        lineAmount: "8.00",
      },
    ],
  },
  baseRule,
);
assert.equal(orderDiscountExcludesShipping?.amountMinor, BigInt(1_000));
assert.equal(
  orderDiscountExcludesShipping?.allocations.some(
    (allocation) => allocation.orderItemId === "shipping-for-order-discount",
  ),
  false,
);

const buyGet = pricePosDiscount(
  {
    currency: "CNY",
    lines: [
      {
        ...context.lines[0]!,
        id: "shirts",
        lineAmount: "90.00",
        quantity: "3.000",
        serviceId: "shirt",
      },
    ],
  },
  {
    ...baseRule,
    type: "buy_x_get_y",
    valueType: "free",
    valueAmount: null,
    buyRequirementType: "minimum_quantity",
    buyRequirementValue: "2.000",
    getQuantity: "1.000",
    targets: [
      {
        role: "customer_buys",
        targetType: "service",
        targetId: "shirt",
      },
      {
        role: "customer_gets",
        targetType: "service",
        targetId: "shirt",
      },
    ],
  },
);
assert.equal(buyGet?.amountMinor, BigInt(3_000));

assert.equal(
  discountsCanCombine(
    { ...baseRule, combinesWithItemDiscounts: true },
    {
      ...baseRule,
      id: "other",
      type: "amount_off_items",
      combinesWithOrderDiscounts: true,
    },
  ),
  true,
);
assert.equal(
  discountsCanCombine(baseRule, { ...baseRule, id: "other" }),
  false,
);
assert.equal(pricePosDiscount(context, { ...baseRule, currency: "USD" }), null);
assert.equal(
  pricePosDiscount(context, {
    ...baseRule,
    usageLimit: 1,
    usageCount: 1,
  }),
  null,
);
assert.equal(
  pricePosDiscount(context, {
    ...baseRule,
    oncePerCustomer: true,
    customerUsageCount: 1,
  }),
  null,
);

console.log("POS discount pricing engine smoke tests passed.");
