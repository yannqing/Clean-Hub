import assert from "node:assert/strict";

import {
  reportPosOfflineSaleExceptionBodySchema,
  resolvePosOfflineSaleExceptionBodySchema,
} from "./offline-sales.validation.js";

const shiftId = "01ARZ3NDEKTSV4RRFFQ69G5FB0";
const orderId = "01ARZ3NDEKTSV4RRFFQ69G5FB1";
const occurredAt = "2026-01-01T10:00:00.000Z";

assert.equal(
  reportPosOfflineSaleExceptionBodySchema.safeParse({
    commandId: "offline-cash-command",
    orderId,
    command: {
      type: "checkout",
      input: {
        expectedTotalAmount: "100.00",
        order: {
          id: orderId,
          orderType: "manual",
          branchId: "01ARZ3NDEKTSV4RRFFQ69G5FB2",
          items: [{ productSkuId: "01ARZ3NDEKTSV4RRFFQ69G5FB3" }],
        },
        payment: {
          paymentMethod: "cash",
          tenderedAmount: "150.00",
          shiftId,
          occurredAt,
          idempotencyKey: "offline-cash-command",
        },
      },
    },
    failureCode: "PRICE_CHANGED",
    failureMessage: "Price changed",
  }).success,
  true,
  "a complete offline cash failure must be reportable",
);

assert.equal(
  resolvePosOfflineSaleExceptionBodySchema.safeParse({
    action: "cash_refunded",
    reason: "Cash returned to the customer",
  }).success,
  true,
  "manager reconciliation must include a reason",
);

assert.equal(
  resolvePosOfflineSaleExceptionBodySchema.safeParse({
    action: "cash_refunded",
    reason: "",
  }).success,
  false,
  "an offline cash exception cannot be closed without an audit reason",
);

console.info("POS offline cash exception smoke passed.");
