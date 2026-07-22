import assert from "node:assert/strict";

import type { Database } from "@cleanhub/db";

import { AuthError } from "../auth/auth.errors.js";
import type { AuthContext } from "../auth/auth.types.js";
import {
  deletePosAccount,
  listPosCustomers,
} from "./customers/customers.service.js";
import {
  deletePosServiceTicket,
  listPosServiceTickets,
} from "./service-tickets/service-tickets.service.js";
import {
  changeServiceTicketStatusBodySchema,
  serviceTicketDeleteQuerySchema,
  updateServiceTicketItemBodySchema,
} from "./service-tickets/service-tickets.validation.js";

const branchA = "01ARZ3NDEKTSV4RRFFQ69G5FAX";
const branchB = "01ARZ3NDEKTSV4RRFFQ69G5FAY";
const entityId = "01ARZ3NDEKTSV4RRFFQ69G5FAZ";
const unreachableDb = {} as Database;

function context(
  role: AuthContext["role"],
  branchIds: string[],
): AuthContext {
  return {
    userId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    displayName: "POS service smoke user",
    tenantId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
    branchIds,
    role,
    roles: [role],
    permissions: [],
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

async function expectForbidden(promise: Promise<unknown>): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    return error instanceof AuthError && error.code === "FORBIDDEN";
  });
}

const emptyCustomerList = await listPosCustomers(
  {
    authContext: context("manager", []),
    query: { limit: 20, offset: 0 },
  },
  unreachableDb,
);
assert.deepEqual(emptyCustomerList.data, []);
assert.equal(emptyCustomerList.total, 0);

await expectForbidden(
  listPosServiceTickets(
    context("manager", [branchA]),
    { branchId: branchB, limit: 20, offset: 0 },
    unreachableDb,
  ),
);

await expectForbidden(
  deletePosAccount(
    {
      authContext: context("cashier", [branchA]),
      accountId: entityId,
      reason: "duplicate",
    },
    unreachableDb,
  ),
);

await expectForbidden(
  deletePosServiceTicket(
    context("cashier", [branchA]),
    entityId,
    "duplicate",
    {},
    unreachableDb,
  ),
);

await assert.rejects(
  deletePosServiceTicket(
    context("manager", [branchA]),
    entityId,
    "   ",
    {},
    unreachableDb,
  ),
);

assert.equal(
  serviceTicketDeleteQuerySchema.parse({ reason: "  duplicate  " }).reason,
  "duplicate",
);
assert.throws(() =>
  changeServiceTicketStatusBodySchema.parse({
    to: "cancelled",
    version: 1,
  }),
);
assert.equal(
  updateServiceTicketItemBodySchema.parse({ chargedUnitAmount: "12.00" })
    .chargedUnitAmount,
  "12.00",
);

console.log("POS access-control service smoke passed.");
