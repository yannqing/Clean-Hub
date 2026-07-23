import assert from "node:assert/strict";

import { orderItems, paymentTransactions } from "@cleanhub/db";
import {
  formatPosOrderCode,
  isPosOrderLookupQuery,
  parsePosOrderCodeSuffix,
} from "@cleanhub/domain/order-codes";
import { getTableConfig } from "drizzle-orm/pg-core";

import { posCatalogQuerySchema } from "../catalog/catalog.validation.js";
import { calculatePosOrderItemLineAmount } from "./orders.repository.js";
import { paymentIntentMatches } from "./orders.service.js";
import type { PosPaymentTransaction } from "./orders.types.js";
import {
  createPosOrderBodySchema,
  createPosOrderItemBodySchema,
  createPosPaymentBodySchema,
} from "./orders.validation.js";

const payment: PosPaymentTransaction = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  orderId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  paymentMethod: "cash",
  amount: "100.00",
  currency: "XOF",
  paymentStatus: "paid",
  provider: null,
  externalReference: null,
  paidAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

assert.equal(
  createPosPaymentBodySchema.safeParse({
    paymentMethod: "cash",
    amount: "100.00",
  }).success,
  false,
  "cash payments must require an idempotency key",
);

const serviceId = "01ARZ3NDEKTSV4RRFFQ69G5FB2";
assert.equal(
  posCatalogQuerySchema.safeParse({
    businessLine: "laundry",
    q: "shirt",
  }).success,
  true,
  "catalog queries should accept supported business-line filters",
);
assert.equal(
  posCatalogQuerySchema.safeParse({ businessLine: "unsupported" }).success,
  false,
  "catalog queries should reject unsupported business lines",
);
assert.equal(
  createPosOrderItemBodySchema.safeParse({
    serviceId,
    weight: "2.500",
    bagCount: 3,
  }).success,
  true,
  "catalog order items should accept weight and bag intake",
);
assert.equal(
  createPosOrderItemBodySchema.safeParse({
    itemName: "free text",
    quantity: "1",
    unitAmount: "100",
  }).success,
  false,
  "new order items must reference a catalog service",
);
assert.equal(
  createPosOrderBodySchema.safeParse({
    orderType: "manual",
    branchId: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
    customerId: "01ARZ3NDEKTSV4RRFFQ69G5FAY",
    items: [{ serviceId, quantity: "2" }],
  }).success,
  true,
  "manual orders should accept catalog-referenced items",
);
assert.equal(
  calculatePosOrderItemLineAmount({
    pricingUnit: "per_item",
    quantity: "3",
    weight: null,
    chargedUnitAmount: "125.00",
  }),
  "375.00",
);
assert.equal(
  calculatePosOrderItemLineAmount({
    pricingUnit: "per_kg",
    quantity: "1",
    weight: "2.500",
    chargedUnitAmount: "120.00",
  }),
  "300.00",
  "weight-priced lines must calculate from measured weight",
);

const orderItemColumns = getTableConfig(orderItems).columns.map(
  (column) => column.name,
);
for (const column of [
  "service_id",
  "pricing_unit",
  "standard_unit_amount",
  "charged_unit_amount",
  "weight",
  "bag_count",
]) {
  assert.equal(
    orderItemColumns.includes(column),
    true,
    `order item pricing snapshot should include ${column}`,
  );
}
assert.equal(
  createPosPaymentBodySchema.safeParse({
    paymentMethod: "app",
    amount: "100.00",
    provider: "wave",
    externalReference: "wave-123",
  }).success,
  false,
  "mobile payments must require an idempotency key",
);

assert.equal(
  paymentIntentMatches(payment, payment.orderId, {
    paymentMethod: "cash",
    amount: "100",
    idempotencyKey: "cash-retry-1",
  }),
  true,
  "cash retries with the same intent should reuse the transaction",
);
assert.equal(
  paymentIntentMatches(payment, payment.orderId, {
    paymentMethod: "cash",
    amount: "99.00",
    idempotencyKey: "cash-retry-1",
  }),
  false,
  "an idempotency key must not be reused with another amount",
);

const mobilePayment: PosPaymentTransaction = {
  ...payment,
  paymentMethod: "app",
  paymentStatus: "pending",
  provider: "wave",
  externalReference: "wave-123",
  paidAt: null,
};
assert.equal(
  paymentIntentMatches(mobilePayment, mobilePayment.orderId, {
    paymentMethod: "app",
    amount: "100.00",
    provider: "wave",
    externalReference: "wave-123",
    idempotencyKey: "mobile-retry-1",
  }),
  true,
  "mobile retries should match provider and external reference",
);
assert.equal(
  paymentIntentMatches(mobilePayment, mobilePayment.orderId, {
    paymentMethod: "app",
    amount: "100.00",
    provider: "orange_money",
    externalReference: "wave-123",
    idempotencyKey: "mobile-retry-1",
  }),
  false,
  "an idempotency key must not be reused with another provider",
);

const gatewayReferenceIndex = getTableConfig(paymentTransactions).indexes.find(
  (index) =>
    index.config.name ===
    "payment_transactions_tenant_gateway_external_id_unique",
);
assert.equal(
  gatewayReferenceIndex?.config.unique,
  true,
  "gateway references need a tenant-scoped database uniqueness guard",
);

const orderId = "01ARZ3NDEKTSV4RRFFQ69G5FAW";
assert.equal(formatPosOrderCode(orderId), "OD-Q69G5FAW");
assert.equal(parsePosOrderCodeSuffix(" od-q69g5faw "), "Q69G5FAW");
assert.equal(isPosOrderLookupQuery("OD-Q69G5FAW"), true);
assert.equal(isPosOrderLookupQuery("ORD-Q69G5FAW"), false);

console.log("POS order/payment smoke passed.");
