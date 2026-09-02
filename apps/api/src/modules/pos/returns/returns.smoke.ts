import assert from "node:assert/strict";

import { calculateReturnSettlement } from "./returns.service.js";

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

console.log("POS product-return settlement smoke passed.");
