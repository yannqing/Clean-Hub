import assert from "node:assert/strict";

import { posPaymentAdjustments, type Database } from "@cleanhub/db";
import { getTableConfig } from "drizzle-orm/pg-core";

import { AuthError } from "../../auth/auth.errors.js";
import type { AuthContext } from "../../auth/auth.types.js";
import {
  buildIdempotentAdjustmentResponse,
  createPosRefund,
} from "./payment-adjustments.service.js";
import {
  createPosPaymentCorrectionBodySchema,
  createPosRefundBodySchema,
} from "./payment-adjustments.validation.js";

const orderId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const paymentId = "01ARZ3NDEKTSV4RRFFQ69G5FAW";

function context(role: AuthContext["role"]): AuthContext {
  return {
    userId: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
    displayName: "Payment adjustment smoke user",
    tenantId: "01ARZ3NDEKTSV4RRFFQ69G5FAY",
    branchIds: ["01ARZ3NDEKTSV4RRFFQ69G5FAZ"],
    role,
    roles: [role],
    permissions: [],
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

const validRefund = {
  orderId,
  originalPaymentId: paymentId,
  amount: "25.00",
  idempotencyKey: "01ARZ3NDEKTSV4RRFFQ69G5FB0",
  reason: "  customer request  ",
};

assert.equal(createPosRefundBodySchema.parse(validRefund).reason, "customer request");
assert.equal(
  createPosRefundBodySchema.safeParse({ ...validRefund, reason: "   " }).success,
  false,
  "refunds must require a reason",
);

const adjustment = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FB2",
  orderId,
  originalPaymentId: paymentId,
  adjustmentType: "refund" as const,
  direction: "debit" as const,
  amount: "100.00",
  currency: "XOF",
  idempotencyKey: validRefund.idempotencyKey,
  reason: "customer request",
  occurredAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  createdBy: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
};
const retried = buildIdempotentAdjustmentResponse(adjustment, {
  id: orderId,
  branchId: "01ARZ3NDEKTSV4RRFFQ69G5FAZ",
  customerId: "01ARZ3NDEKTSV4RRFFQ69G5FB3",
  currency: "XOF",
  totalAmount: "100.00",
  paidAmount: "0.00",
  paymentStatus: "refunded",
  status: "received",
});
assert.equal(
  retried.paymentStatus,
  "refunded",
  "a fully refunded idempotent retry must preserve the stored payment status",
);
assert.equal(
  createPosPaymentCorrectionBodySchema.safeParse({
    orderId,
    originalPaymentId: paymentId,
    direction: "credit",
    amount: "0",
    idempotencyKey: "01ARZ3NDEKTSV4RRFFQ69G5FB1",
    reason: "payment reconciliation",
  }).success,
  false,
  "payment corrections must be positive",
);
assert.equal(
  createPosPaymentCorrectionBodySchema.safeParse({
    orderId,
    direction: "credit",
    amount: "10.00",
    idempotencyKey: "01ARZ3NDEKTSV4RRFFQ69G5FB1",
    reason: "payment reconciliation",
  }).success,
  false,
  "payment corrections must link an original paid transaction",
);

await assert.rejects(
  createPosRefund(
    { authContext: context("cashier"), data: validRefund },
    {} as Database,
  ),
  (error: unknown) => error instanceof AuthError && error.code === "FORBIDDEN",
  "cashiers must not be able to refund a payment",
);

const table = getTableConfig(posPaymentAdjustments);
assert.equal(
  table.indexes.find(
    (index) =>
      index.config.name ===
      "pos_payment_adjustments_tenant_idempotency_unique",
  )?.config.unique,
  true,
  "payment adjustments need a tenant-scoped idempotency guard",
);

console.log("POS payment-adjustment smoke passed.");
