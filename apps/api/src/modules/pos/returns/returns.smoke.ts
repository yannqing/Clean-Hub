import assert from "node:assert/strict";

import { calculateReturnSettlement } from "./returns.service.js";
import { createPosProductReturnBodySchema } from "./returns.validation.js";

assert.deepEqual(calculateReturnSettlement(100, 60), {
  refundAmount: 40,
  exchangeCreditAmount: 60,
  additionalDueAmount: 0,
});
assert.deepEqual(calculateReturnSettlement(100, 150), {
  refundAmount: 0,
  exchangeCreditAmount: 100,
  additionalDueAmount: 50,
});
assert.deepEqual(calculateReturnSettlement(100, 0), {
  refundAmount: 100,
  exchangeCreditAmount: 0,
  additionalDueAmount: 0,
});

// A return request must not be able to dictate how much of the refund each
// payment absorbs. Supplying allocations used to skip
// allocateRefundAcrossPaidPayments entirely -- the function that caps each
// allocation at that payment's remaining refundable balance.
const baseReturn = {
  idempotencyKey: "01ARZ3NDEKTSV4RRFFQ69G5RT0",
  reason: "Customer returned the item",
  items: [
    {
      orderItemId: "01ARZ3NDEKTSV4RRFFQ69G5RT1",
      quantity: "1",
      condition: "good" as const,
      disposition: "restock" as const,
    },
  ],
};

const withAmounts = createPosProductReturnBodySchema.safeParse({
  ...baseReturn,
  refundAllocations: [
    { originalPaymentId: "01ARZ3NDEKTSV4RRFFQ69G5RT2", amount: "999.00" },
  ],
});
assert.equal(
  withAmounts.success && "refundAllocations" in withAmounts.data,
  false,
  "a caller-supplied refund allocation must never reach the service",
);

// Settlement references are still accepted: they let a cashier record that a
// non-cash refund already settled, without touching the amounts.
const withSettlements = createPosProductReturnBodySchema.safeParse({
  ...baseReturn,
  refundSettlements: [
    {
      originalPaymentId: "01ARZ3NDEKTSV4RRFFQ69G5RT2",
      settlementReference: "wave-ref-1",
    },
  ],
});
assert.equal(
  withSettlements.success,
  true,
  "settlement references must still be accepted",
);
assert.equal(
  withSettlements.success &&
    withSettlements.data.refundSettlements?.[0]?.settlementReference,
  "wave-ref-1",
);

// A settlement entry carries no amount field to smuggle one through.
const settlementWithAmount = createPosProductReturnBodySchema.safeParse({
  ...baseReturn,
  refundSettlements: [
    {
      originalPaymentId: "01ARZ3NDEKTSV4RRFFQ69G5RT2",
      settlementReference: "wave-ref-1",
      amount: "999.00",
    },
  ],
});
assert.equal(
  settlementWithAmount.success &&
    "amount" in
      (settlementWithAmount.data.refundSettlements?.[0] ?? {}),
  false,
  "an amount must not survive parsing inside a settlement entry",
);

// A reference without an actual reference string is meaningless.
assert.equal(
  createPosProductReturnBodySchema.safeParse({
    ...baseReturn,
    refundSettlements: [
      { originalPaymentId: "01ARZ3NDEKTSV4RRFFQ69G5RT2" },
    ],
  }).success,
  false,
  "a settlement entry must carry its provider reference",
);

console.log("POS product-return settlement smoke passed.");
