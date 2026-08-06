import assert from "node:assert/strict";

import {
  createTenantCustomerCommentBodySchema,
  deleteTenantCustomerCommentBodySchema,
  tenantCustomerAttachmentUploadBodySchema,
  tenantCustomerAccountCustomersQuerySchema,
  tenantCustomerAccountListQuerySchema,
  tenantCustomerAccountParamsSchema,
  tenantCustomerCommentParamsSchema,
  tenantCustomerListQuerySchema,
  tenantCustomerOverviewQuerySchema,
  tenantCustomerParamsSchema,
  tenantCustomerTimelineQuerySchema,
  updateTenantCustomerCommentBodySchema,
  updateTenantCustomerAccountBodySchema,
} from "../customers/customers.validation.js";
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
    q: "  Alice  ",
  }),
  {
    branchId: BRANCH_ID,
    sort: "created_desc",
    limit: 100,
    offset: 10,
    q: "Alice",
  },
);
assert.equal(
  tenantCustomerListQuerySchema.safeParse({ branchId: "not-an-ulid" }).success,
  false,
  "customer branch filters require a valid ULID",
);
assert.deepEqual(tenantCustomerOverviewQuerySchema.parse({}), {});
assert.deepEqual(
  tenantCustomerParamsSchema.parse({ customerId: CUSTOMER_ID }),
  { customerId: CUSTOMER_ID },
);
assert.equal(
  tenantCustomerParamsSchema.safeParse({ customerId: "not-an-id" }).success,
  false,
  "customer details require a valid ULID",
);
assert.equal(
  tenantCustomerOverviewQuerySchema.safeParse({
    createdAfter: "2026-08-05T12:00:00.000Z",
    createdBefore: "2026-08-05T11:00:00.000Z",
  }).success,
  false,
  "customer overview date ranges must be ordered",
);
assert.deepEqual(tenantCustomerTimelineQuerySchema.parse({}), { limit: 20 });
assert.equal(
  tenantCustomerTimelineQuerySchema.safeParse({ limit: "51" }).success,
  false,
  "customer timelines enforce a bounded page size",
);
assert.deepEqual(
  createTenantCustomerCommentBodySchema.parse({
    body: "  Follow up next week  ",
    idempotencyKey: "customer-comment-1",
  }),
  {
    body: "Follow up next week",
    idempotencyKey: "customer-comment-1",
    mentionedUserIds: [],
    attachments: [],
  },
);
assert.deepEqual(
  tenantCustomerCommentParamsSchema.parse({
    customerId: CUSTOMER_ID,
    commentId: ORDER_ID,
  }),
  { customerId: CUSTOMER_ID, commentId: ORDER_ID },
);
assert.equal(
  createTenantCustomerCommentBodySchema.safeParse({
    body: "   ",
    idempotencyKey: "customer-comment-2",
  }).success,
  false,
  "customer comments reject empty content",
);
assert.deepEqual(
  updateTenantCustomerCommentBodySchema.parse({
    body: " Updated follow-up ",
    version: 2,
    mentionedUserIds: [CUSTOMER_ID],
  }),
  {
    body: "Updated follow-up",
    version: 2,
    mentionedUserIds: [CUSTOMER_ID],
  },
);
assert.deepEqual(deleteTenantCustomerCommentBodySchema.parse({ version: 3 }), {
  version: 3,
});
assert.deepEqual(
  tenantCustomerAttachmentUploadBodySchema.parse({
    contentType: "image/webp",
    sizeBytes: 2048,
  }),
  { contentType: "image/webp", sizeBytes: 2048 },
);
assert.equal(
  tenantCustomerAttachmentUploadBodySchema.safeParse({
    contentType: "application/pdf",
    sizeBytes: 2048,
  }).success,
  false,
  "customer timeline attachments only accept safe image formats",
);

assert.deepEqual(tenantCustomerAccountListQuerySchema.parse({}), {
  sort: "created_desc",
  limit: 50,
  offset: 0,
});
assert.deepEqual(
  tenantCustomerAccountListQuerySchema.parse({
    q: "  Alice  ",
    status: "active",
    sort: "name_asc",
    limit: "10",
    offset: "20",
  }),
  {
    q: "Alice",
    status: "active",
    sort: "name_asc",
    limit: 10,
    offset: 20,
  },
);
assert.deepEqual(tenantCustomerAccountCustomersQuerySchema.parse({}), {
  limit: 20,
  offset: 0,
});
assert.deepEqual(
  tenantCustomerAccountParamsSchema.parse({ accountId: CUSTOMER_ID }),
  { accountId: CUSTOMER_ID },
);
assert.deepEqual(
  updateTenantCustomerAccountBodySchema.parse({
    accountName: "  Family account  ",
    phone: null,
    email: " FAMILY@EXAMPLE.COM ",
    status: "disabled",
    version: 3,
  }),
  {
    accountName: "Family account",
    phone: null,
    email: "FAMILY@EXAMPLE.COM",
    status: "disabled",
    version: 3,
  },
);
assert.equal(
  updateTenantCustomerAccountBodySchema.safeParse({ version: 3 }).success,
  false,
  "account updates require at least one mutable field",
);

console.log("Tenant order/customer read validation smoke passed.");
