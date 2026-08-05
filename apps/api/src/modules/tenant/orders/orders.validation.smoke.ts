import assert from "node:assert/strict";

import { tenantCustomerListQuerySchema } from "../customers/customers.validation.js";
import {
  createTenantOrderCommentBodySchema,
  createTenantOrderItemBodySchema,
  createTenantOrderPaymentBodySchema,
  createTenantOrderPaymentCorrectionBodySchema,
  createTenantOrderRefundBodySchema,
  changeTenantOrderStatusBodySchema,
  deleteTenantOrderCommentBodySchema,
  tenantOrderImportBodySchema,
  tenantOrderListQuerySchema,
  tenantOrderOverviewQuerySchema,
  tenantOrderTimelineQuerySchema,
  tenantOrderAttachmentUploadBodySchema,
  updateTenantOrderCommentBodySchema,
  updateTenantOrderItemBodySchema,
} from "./orders.validation.js";

const BRANCH_ID = "01KRERJN800000000000000001";
const ORDER_ID = "01SEED01000RD0000000000014";
const CUSTOMER_ID = "01SEED0100CPS0000000000001";
const SERVICE_ID = "01SEED0100SVC0000000000001";
const PAYMENT_ID = "01SEED0100PAY0000000000001";

assert.deepEqual(tenantOrderListQuerySchema.parse({}), {
  sort: "created_desc",
  limit: 50,
  offset: 0,
});
assert.deepEqual(
  tenantOrderOverviewQuerySchema.parse({ branchId: BRANCH_ID }),
  {
    period: "today",
    branchId: BRANCH_ID,
  },
);
assert.deepEqual(
  createTenantOrderItemBodySchema.parse({
    serviceId: SERVICE_ID,
    quantity: "2",
  }),
  { serviceId: SERVICE_ID, quantity: "2" },
);
assert.deepEqual(
  updateTenantOrderItemBodySchema.parse({
    quantity: "3",
    version: 2,
  }),
  { quantity: "3", version: 2 },
);
assert.deepEqual(
  createTenantOrderRefundBodySchema.parse({
    originalPaymentId: PAYMENT_ID,
    amount: "10.00",
    idempotencyKey: "tenant-refund-1",
    reason: "Customer request",
  }),
  {
    originalPaymentId: PAYMENT_ID,
    amount: "10.00",
    idempotencyKey: "tenant-refund-1",
    reason: "Customer request",
  },
);
assert.equal(
  createTenantOrderPaymentCorrectionBodySchema.safeParse({
    originalPaymentId: PAYMENT_ID,
    direction: "debit",
    amount: "0",
    idempotencyKey: "tenant-correction-1",
    reason: "Reconciliation",
  }).success,
  false,
  "tenant payment corrections require a positive amount",
);
assert.equal(
  tenantOrderListQuerySchema.safeParse({
    createdAfter: "2026-08-02T12:00:00.000Z",
    createdBefore: "2026-08-02T11:00:00.000Z",
  }).success,
  false,
  "order queries reject inverted date ranges",
);
assert.deepEqual(
  changeTenantOrderStatusBodySchema.parse({
    to: "cancelled",
    reason: "Customer request",
    version: 2,
  }),
  { to: "cancelled", reason: "Customer request", version: 2 },
);
assert.deepEqual(
  createTenantOrderPaymentBodySchema.parse({
    paymentMethod: "cash",
    amount: "12.50",
    idempotencyKey: "payment-import-1",
  }),
  {
    paymentMethod: "cash",
    amount: "12.50",
    idempotencyKey: "payment-import-1",
  },
);
assert.deepEqual(
  tenantOrderImportBodySchema.parse({
    orders: [
      {
        id: ORDER_ID,
        importKey: "external-1001",
        branchId: BRANCH_ID,
        customerId: CUSTOMER_ID,
        items: [{ serviceId: SERVICE_ID, quantity: "2" }],
      },
    ],
  }).orders[0]?.items[0],
  { serviceId: SERVICE_ID, quantity: "2" },
);
assert.equal(
  tenantOrderImportBodySchema.safeParse({
    orders: [
      {
        id: ORDER_ID,
        importKey: "external-1001",
        branchId: BRANCH_ID,
        customerId: CUSTOMER_ID,
        items: [{ serviceId: SERVICE_ID }],
      },
    ],
  }).success,
  false,
  "order imports require quantity or weight for every item",
);
assert.deepEqual(tenantOrderTimelineQuerySchema.parse({}), { limit: 20 });
assert.equal(
  tenantOrderTimelineQuerySchema.safeParse({ limit: "51" }).success,
  false,
  "order timelines enforce a bounded page size",
);
assert.deepEqual(
  createTenantOrderCommentBodySchema.parse({
    body: "  Internal note  ",
    idempotencyKey: "01K00000000000000000000001",
  }),
  {
    body: "Internal note",
    idempotencyKey: "01K00000000000000000000001",
    mentionedUserIds: [],
    attachments: [],
  },
);
assert.deepEqual(
  tenantOrderAttachmentUploadBodySchema.parse({
    contentType: "image/png",
    sizeBytes: 1024,
  }),
  { contentType: "image/png", sizeBytes: 1024 },
);
assert.equal(
  tenantOrderAttachmentUploadBodySchema.safeParse({
    contentType: "application/pdf",
    sizeBytes: 1024,
  }).success,
  false,
  "comment attachments only accept safe image formats",
);
assert.equal(
  createTenantOrderCommentBodySchema.safeParse({
    body: "   ",
    idempotencyKey: "comment",
  }).success,
  false,
  "order comments reject empty content",
);
assert.deepEqual(
  updateTenantOrderCommentBodySchema.parse({
    body: "  Updated note  ",
    version: 2,
    mentionedUserIds: [CUSTOMER_ID],
  }),
  {
    body: "Updated note",
    version: 2,
    mentionedUserIds: [CUSTOMER_ID],
  },
);
assert.deepEqual(deleteTenantOrderCommentBodySchema.parse({ version: 3 }), {
  version: 3,
});
assert.equal(
  updateTenantOrderCommentBodySchema.safeParse({
    body: "Updated note",
    version: 0,
  }).success,
  false,
  "comment mutations require a positive optimistic version",
);

assert.deepEqual(tenantCustomerListQuerySchema.parse({}), {
  sort: "created_desc",
  limit: 50,
  offset: 0,
});
assert.deepEqual(
  tenantCustomerListQuerySchema.parse({
    branchId: BRANCH_ID,
    limit: "100",
    offset: "10",
  }),
  {
    branchId: BRANCH_ID,
    sort: "created_desc",
    limit: 100,
    offset: 10,
  },
);
assert.equal(
  tenantCustomerListQuerySchema.safeParse({ branchId: "not-an-ulid" }).success,
  false,
  "customer branch filters require a valid ULID",
);

console.log("Tenant order/customer read validation smoke passed.");
