import assert from "node:assert/strict";

import {
  orderItems,
  orders,
  paymentTransactions,
  posOfflineSaleExceptions,
  serviceTickets,
} from "@cleanhub/db";
import {
  formatPosOrderCode,
  isPosOrderLookupQuery,
  parsePosOrderCodeSuffix,
} from "@cleanhub/domain/order-codes";
import { getTableConfig } from "drizzle-orm/pg-core";

import { posCatalogQuerySchema } from "../catalog/catalog.validation.js";
import { createServiceTicketBodySchema } from "../service-tickets/service-tickets.validation.js";
import { calculatePosOrderItemLineAmount } from "./orders.repository.js";
import {
  assertProductStockCanBeReserved,
  getProductReservationExpiresAt,
} from "./orders.inventory.js";
import {
  assertGuestOrderItemAllowed,
  paymentIntentMatches,
} from "./orders.service.js";
import type { PosPaymentTransaction } from "./orders.types.js";
import {
  createPosOrderBodySchema,
  createPosCheckoutBodySchema,
  createPosOrderItemBodySchema,
  createPosPaymentBodySchema,
} from "./orders.validation.js";

const cashOccurredAt = new Date().toISOString();
const cashShiftId = "01ARZ3NDEKTSV4RRFFQ69G5FB0";
const payment: PosPaymentTransaction = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  orderId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  paymentMethod: "cash",
  amount: "100.00",
  tenderedAmount: "150.00",
  changeAmount: "50.00",
  shiftId: cashShiftId,
  currency: "XOF",
  paymentStatus: "paid",
  providerStatus: "not_applicable",
  provider: null,
  gateway: null,
  externalReference: null,
  authorizationCode: null,
  failureCode: null,
  failureReason: null,
  paidAt: cashOccurredAt,
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
assert.equal(
  createPosCheckoutBodySchema.safeParse({
    expectedTotalAmount: "100.00",
    order: {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
      orderType: "manual",
      branchId: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
      items: [
        {
          productSkuId: "01ARZ3NDEKTSV4RRFFQ69G5FB3",
          quantity: "1",
        },
      ],
    },
    payment: {
      paymentMethod: "cash",
      tenderedAmount: "150.00",
      shiftId: cashShiftId,
      occurredAt: cashOccurredAt,
      idempotencyKey: "01ARZ3NDEKTSV4RRFFQ69G5FB4",
    },
  }).success,
  true,
  "atomic checkout must accept stable order and payment identifiers",
);
assert.equal(
  createPosCheckoutBodySchema.safeParse({
    order: {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
      orderType: "manual",
      branchId: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
      items: [{ productSkuId: "01ARZ3NDEKTSV4RRFFQ69G5FB3" }],
    },
  }).success,
  false,
  "checkout must require the operator-confirmed total",
);
assert.equal(
  createPosPaymentBodySchema.safeParse({
    paymentMethod: "cash",
    amount: "100.00",
    tenderedAmount: "99.00",
    shiftId: cashShiftId,
    occurredAt: cashOccurredAt,
    idempotencyKey: "cash-short",
  }).success,
  false,
  "cash tender must cover the recorded payment amount",
);

const serviceId = "01ARZ3NDEKTSV4RRFFQ69G5FB2";
const productSkuId = "01ARZ3NDEKTSV4RRFFQ69G5FB3";
const ticketId = "01ARZ3NDEKTSV4RRFFQ69G5FB4";
const ticketItemId = "01ARZ3NDEKTSV4RRFFQ69G5FB5";
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
    productSkuId,
    quantity: "2",
  }).success,
  true,
  "manual order items should accept a real product SKU",
);
assert.equal(
  createPosOrderItemBodySchema.safeParse({
    serviceId,
    productSkuId,
    quantity: "1",
  }).success,
  false,
  "an order item must not mix service and product references",
);
assert.equal(
  createPosOrderBodySchema.safeParse({
    orderType: "manual",
    branchId: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
    customerId: "01ARZ3NDEKTSV4RRFFQ69G5FAY",
    items: [
      { productSkuId, quantity: "2" },
      { ticketId, ticketItemId },
    ],
  }).success,
  true,
  "cart orders should accept products and existing ticket items together",
);
assert.equal(
  createPosOrderItemBodySchema.safeParse({
    ticketId,
  }).success,
  false,
  "ticket item references must include both the ticket and item ids",
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
  createPosOrderBodySchema.safeParse({
    orderType: "manual",
    branchId: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
    items: [{ productSkuId, quantity: "2" }],
  }).success,
  true,
  "manual product orders should allow a missing customer profile",
);
assert.equal(
  createServiceTicketBodySchema.safeParse({
    customerId: "01ARZ3NDEKTSV4RRFFQ69G5FAY",
    branchId: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
    ticketType: "retail",
  }).success,
  false,
  "retail sales must not be accepted as service-ticket workflows",
);
assert.equal(
  createServiceTicketBodySchema.safeParse({
    customerId: "01ARZ3NDEKTSV4RRFFQ69G5FAY",
    branchId: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
    ticketType: "delivery",
  }).success,
  false,
  "delivery tasks must not be accepted as service-ticket workflows",
);
assert.doesNotThrow(
  () => assertGuestOrderItemAllowed(null, "product"),
  "walk-in orders should accept retail catalog items",
);
assert.throws(
  () => assertGuestOrderItemAllowed(null, "service"),
  /customer profile is required/i,
  "walk-in orders must not bypass customer identification for services",
);
assert.doesNotThrow(
  () =>
    assertProductStockCanBeReserved({
      onHandQuantity: "10",
      reservedQuantity: "3",
      requestedQuantity: "7",
      allowNegativeStock: false,
    }),
  "available stock should account for active reservations",
);
assert.throws(
  () =>
    assertProductStockCanBeReserved({
      onHandQuantity: "10",
      reservedQuantity: "3",
      requestedQuantity: "8",
      allowNegativeStock: false,
    }),
  /Only 7 unit/i,
  "orders must reject quantities above available stock",
);
assert.doesNotThrow(
  () =>
    assertProductStockCanBeReserved({
      onHandQuantity: "0",
      reservedQuantity: "0",
      requestedQuantity: "2",
      allowNegativeStock: true,
    }),
  "negative-stock branches should remain explicitly supported",
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
  "product_sku_id",
  "product_price_id",
  "sku_snapshot",
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
  getTableConfig(orders).columns.find((column) => column.name === "customer_id")
    ?.notNull,
  false,
  "orders should support walk-in customers without a profile",
);
assert.equal(
  getTableConfig(orderItems).columns.find(
    (column) => column.name === "customer_id",
  )?.notNull,
  false,
  "walk-in order items should not require a customer profile",
);
assert.equal(
  getTableConfig(serviceTickets).checks.some(
    (constraint) => constraint.name === "service_tickets_service_type_check",
  ),
  true,
  "service tickets should enforce service-only workflows",
);
assert.equal(
  getTableConfig(paymentTransactions).columns.some(
    (column) => column.name === "tendered_amount",
  ),
  true,
  "cash transactions must persist the tendered amount",
);
assert.equal(
  getTableConfig(posOfflineSaleExceptions).indexes.some(
    (index) =>
      index.config.name === "pos_offline_sale_exceptions_tenant_command_unique",
  ),
  true,
  "offline cash exception commands must be idempotent",
);
assert(
  getProductReservationExpiresAt(new Date("2026-01-01T00:00:00.000Z")) >
    new Date("2026-01-01T00:00:00.000Z"),
  "product reservations must always receive a future expiry",
);
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
    tenderedAmount: "150.00",
    shiftId: cashShiftId,
    occurredAt: cashOccurredAt,
    idempotencyKey: "cash-retry-1",
  }),
  true,
  "cash retries with the same intent should reuse the transaction",
);
assert.equal(
  paymentIntentMatches(payment, payment.orderId, {
    paymentMethod: "cash",
    amount: "99.00",
    tenderedAmount: "150.00",
    shiftId: cashShiftId,
    occurredAt: cashOccurredAt,
    idempotencyKey: "cash-retry-1",
  }),
  false,
  "an idempotency key must not be reused with another amount",
);
assert.equal(
  paymentIntentMatches(payment, payment.orderId, {
    paymentMethod: "cash",
    amount: "100.00",
    tenderedAmount: "200.00",
    shiftId: cashShiftId,
    occurredAt: cashOccurredAt,
    idempotencyKey: "cash-retry-1",
  }),
  false,
  "cash idempotency must include the tendered amount",
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
