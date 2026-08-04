import assert from "node:assert/strict";

import { tenantCustomerListQuerySchema } from "../customers/customers.validation.js";
import {
  tenantOrderListQuerySchema,
  tenantOrderOverviewQuerySchema,
} from "./orders.validation.js";

const BRANCH_ID = "01KRERJN800000000000000001";

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
assert.equal(
  tenantOrderListQuerySchema.safeParse({
    createdAfter: "2026-08-02T12:00:00.000Z",
    createdBefore: "2026-08-02T11:00:00.000Z",
  }).success,
  false,
  "order queries reject inverted date ranges",
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
  tenantCustomerListQuerySchema.safeParse({ branchId: "not-an-ulid" })
    .success,
  false,
  "customer branch filters require a valid ULID",
);

console.log("Tenant order/customer read validation smoke passed.");
