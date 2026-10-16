import assert from "node:assert/strict";

import { AuthError } from "../modules/auth/auth.errors.js";
import { createCustomerPasswordChangeMiddleware } from "./customer-password-change.middleware.js";

/**
 * Staff hand every customer the same starter password, so an account that has
 * not moved off it is protected by nothing but its phone number. This gate is
 * the entire reason that is acceptable, and it has to hold on the server: the
 * mobile API is reachable directly, so hiding screens in the app protects
 * nobody.
 */

type Case = {
  label: string;
  method: string;
  path: string;
  context: Record<string, unknown>;
  allowed: boolean;
};

const customerOnStarter = {
  subjectType: "customer",
  mustChangePassword: true,
};

const cases: Case[] = [
  {
    label: "change-password is the one way out",
    method: "POST",
    path: "/mobile/customer/password",
    context: customerOnStarter,
    allowed: true,
  },
  {
    label: "profile is closed",
    method: "GET",
    path: "/mobile/customer/profile",
    context: customerOnStarter,
    allowed: false,
  },
  {
    label: "orders are closed",
    method: "GET",
    path: "/mobile/customer/orders",
    context: customerOnStarter,
    allowed: false,
  },
  {
    label: "refunds are closed",
    method: "POST",
    path: "/mobile/payment/orders/order_1/refund-requests",
    context: customerOnStarter,
    allowed: false,
  },
  {
    // Reading the change-password route must not become a way to probe around
    // it; only the POST that actually sets a password is allowed through.
    label: "a GET on the change-password path is still closed",
    method: "GET",
    path: "/mobile/customer/password",
    context: customerOnStarter,
    allowed: false,
  },
  {
    label: "a customer who has chosen a password is unaffected",
    method: "GET",
    path: "/mobile/customer/orders",
    context: { subjectType: "customer", mustChangePassword: false },
    allowed: true,
  },
  {
    label: "a context with no flag at all is unaffected",
    method: "GET",
    path: "/mobile/customer/orders",
    context: { subjectType: "customer" },
    allowed: true,
  },
  {
    // Staff never carry the flag, and must not be gated by it even if a stale
    // one somehow appeared on their context.
    label: "staff are never held by the customer gate",
    method: "GET",
    path: "/mobile/owner/overview",
    context: { subjectType: "staff", mustChangePassword: true },
    allowed: true,
  },
];

const middleware = createCustomerPasswordChangeMiddleware();

for (const testCase of cases) {
  let nextCalled = false;
  const context = {
    get: () => testCase.context,
    req: { method: testCase.method, path: testCase.path },
  };

  const run = async () =>
    // The middleware only uses `get` and `req`; the cast keeps this a unit test
    // rather than a Hono integration test.
    (middleware as unknown as (
      c: typeof context,
      next: () => Promise<void>,
    ) => Promise<void>)(context, async () => {
      nextCalled = true;
    });

  if (testCase.allowed) {
    await run();
    assert.equal(nextCalled, true, `${testCase.label}: should pass through`);
    continue;
  }

  await assert.rejects(
    run,
    (error: unknown) =>
      error instanceof AuthError &&
      error.code === "PASSWORD_CHANGE_REQUIRED",
    `${testCase.label}: should be refused`,
  );
  assert.equal(
    nextCalled,
    false,
    `${testCase.label}: must not reach the handler`,
  );
}

console.log("customer password change gate smoke passed.");
