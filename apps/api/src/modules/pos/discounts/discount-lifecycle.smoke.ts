import assert from "node:assert/strict";

import type { AuthContext } from "../../auth/auth.types.js";
import { authorizePosSensitiveOperation } from "../access-control.helper.js";
import { projectPosOrderPaymentState } from "../orders/order-payment-state.js";
import { applyPosOrderDiscountBodySchema } from "./discounts.validation.js";

const settledAt = new Date("2026-07-26T12:00:00.000Z");
const zeroTotal = projectPosOrderPaymentState({
  current: {
    totalAmount: "100.00",
    paidAmount: "0.00",
    paymentStatus: "unpaid",
    paidAt: null,
    status: "received",
  },
  nextTotalAmount: "0.00",
  nextPaidAmount: "0.00",
  zeroTotalSettlement: true,
  now: settledAt,
});
assert.deepEqual(zeroTotal, {
  paymentStatus: "paid",
  paidAt: settledAt,
  status: "received",
});

const originalSettledAt = new Date("2026-07-26T11:00:00.000Z");
const zeroTotalReplay = projectPosOrderPaymentState({
  current: {
    totalAmount: "0.00",
    paidAmount: "0.00",
    paymentStatus: "paid",
    paidAt: originalSettledAt,
    status: "received",
  },
  nextTotalAmount: "0.00",
  nextPaidAmount: "0.00",
  zeroTotalSettlement: true,
  now: settledAt,
});
assert.equal(zeroTotalReplay.paidAt, originalSettledAt);
assert.equal(zeroTotalReplay.status, "received");

const discountRemoved = projectPosOrderPaymentState({
  current: {
    totalAmount: "0.00",
    paidAmount: "0.00",
    paymentStatus: "paid",
    paidAt: originalSettledAt,
    status: "received",
  },
  nextTotalAmount: "100.00",
  nextPaidAmount: "0.00",
  now: settledAt,
});
assert.deepEqual(discountRemoved, {
  paymentStatus: "unpaid",
  paidAt: null,
  status: "received",
});

const emptyOrder = projectPosOrderPaymentState({
  current: {
    totalAmount: "0.00",
    paidAmount: "0.00",
    paymentStatus: "unpaid",
    paidAt: null,
    status: "received",
  },
  nextTotalAmount: "0.00",
  nextPaidAmount: "0.00",
});
assert.deepEqual(emptyOrder, {
  paymentStatus: "unpaid",
  paidAt: null,
  status: "received",
});

const paidByTransaction = projectPosOrderPaymentState({
  current: {
    totalAmount: "100.00",
    paidAmount: "0.00",
    paymentStatus: "unpaid",
    paidAt: null,
    status: "received",
  },
  nextTotalAmount: "100.00",
  nextPaidAmount: "100.00",
  latestPaidTransactionAt: settledAt,
});
assert.deepEqual(paidByTransaction, {
  paymentStatus: "paid",
  paidAt: settledAt,
  status: "paid",
});

assert.equal(
  applyPosOrderDiscountBodySchema.safeParse({
    code: "SAVE100",
    version: 1,
    idempotencyKey: "discount-attempt-1",
  }).success,
  false,
);
assert.equal(
  applyPosOrderDiscountBodySchema.safeParse({
    code: "SAVE100",
    reason: "Customer recovery",
    version: 1,
    idempotencyKey: "discount-attempt-1",
  }).success,
  true,
);

function authContext(role: AuthContext["role"]): AuthContext {
  return {
    userId: "01TEST00000000000000000001",
    displayName: "Test",
    tenantId: "01TEST00000000000000000002",
    branchIds: ["01TEST00000000000000000003"],
    role,
    roles: [role],
    permissions: [],
    accessTokenExpiresAt: "2026-07-26T13:00:00.000Z",
  };
}

assert.equal(
  authorizePosSensitiveOperation(
    authContext("manager"),
    "discount",
    "  Customer recovery  ",
  ),
  "Customer recovery",
);
assert.throws(() =>
  authorizePosSensitiveOperation(
    authContext("cashier"),
    "discount",
    "Customer recovery",
  ),
);

console.log("POS discount lifecycle smoke tests passed.");
