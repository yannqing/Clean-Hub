import assert from "node:assert/strict";
import {
  PaymentService,
  type PaymentRepositoryLike,
} from "./payment.service.js";
import { MockPaymentGateway } from "./mock-payment.gateway.js";
import { PaymentError } from "./payment.types.js";

assert.equal(
  process.env.NODE_ENV,
  "production",
  "Run this guard check in production mode",
);
let repositoryTouched = false;
const repository = new Proxy(
  {},
  {
    get() {
      repositoryTouched = true;
      throw new Error("Production mock callback reached the ledger");
    },
  },
) as PaymentRepositoryLike;
const gateway = new MockPaymentGateway({
  secret: "isolated-test-only",
  paymentBaseUrl: "https://example.invalid",
});
const service = new PaymentService({
  repository,
  gateway,
  config: {
    gateway: "mock",
    mockSecret: "isolated-test-only",
    mockPaymentBaseUrl: "https://example.invalid",
  },
});
const callback = gateway.createSignedCallbackPayload({
  action: "pay",
  tenantId: "isolated",
  externalId: "test",
  event: "test",
  status: "paid",
  amount: "100.00",
});
await assert.rejects(
  () => service.handleWebhook({ gateway: "mock", ...callback }),
  (error: unknown) => error instanceof PaymentError && error.status === 422,
);
assert.equal(
  repositoryTouched,
  false,
  "Mock callbacks must be rejected before any ledger access",
);
console.log("Production mock payment guard passed");
