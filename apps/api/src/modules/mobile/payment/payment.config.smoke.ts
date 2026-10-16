import assert from "node:assert/strict";

import { loadPaymentConfig } from "./payment.config.js";

// The mock webhook route is mounted before the auth middleware, so this HMAC
// secret is the only thing preventing a forged callback from marking an order
// paid. A value committed to the source tree is not a secret, so production
// must supply its own rather than silently inheriting the fallback.
assert.throws(
  () => loadPaymentConfig({ NODE_ENV: "production" }),
  /PAYMENT_MOCK_SECRET is required in production/,
  "production must refuse to start without a configured webhook secret",
);

assert.throws(
  () => loadPaymentConfig({ NODE_ENV: "production", PAYMENT_MOCK_SECRET: "   " }),
  /PAYMENT_MOCK_SECRET is required in production/,
  "a blank secret must not satisfy the production requirement",
);

assert.equal(
  loadPaymentConfig({
    NODE_ENV: "production",
    PAYMENT_MOCK_SECRET: "a-real-production-secret",
  }).mockSecret,
  "a-real-production-secret",
  "a configured production secret is used as-is",
);

// Local development keeps working without any configuration.
const development = loadPaymentConfig({ NODE_ENV: "development" });
assert.equal(
  typeof development.mockSecret === "string" &&
    development.mockSecret.length > 0,
  true,
  "development falls back to a usable secret",
);
assert.equal(
  loadPaymentConfig({ PAYMENT_MOCK_SECRET: "explicit" }).mockSecret,
  "explicit",
  "an explicit secret wins outside production too",
);

// An unrecognised gateway must fail loudly rather than silently resolving to
// the mock one once real gateways exist.
assert.throws(
  () => loadPaymentConfig({ PAYMENT_GATEWAY: "stripe" }),
  /Unsupported PAYMENT_GATEWAY/,
  "an unknown gateway must not silently fall back to the mock gateway",
);
assert.equal(loadPaymentConfig({}).gateway, "mock");
assert.equal(loadPaymentConfig({ PAYMENT_GATEWAY: "mock" }).gateway, "mock");

console.log("payment config smoke passed.");
