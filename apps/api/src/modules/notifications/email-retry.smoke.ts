import assert from "node:assert/strict";

import { loadEmailRetrySettings } from "./email-config.js";
import { loadEmailConfig } from "./email-config.js";

/**
 * Retry backoff must be readable without SMTP.
 *
 * `markDeliverySendFailure` needs these numbers, and the most common reason an
 * email delivery fails is that SMTP is not configured at all. Reading them from
 * the full config threw a second time inside the failure handler, escaped the
 * per-item catch, and took down the whole delivery pass -- push included, since
 * both channels are processed together. A deployment running push-only (no
 * SMTP yet) therefore delivered nothing.
 */

// The full config still refuses to load without a host: sending really does
// need one, and that guard must stay.
assert.throws(
  () => loadEmailConfig({}),
  /EMAIL_SMTP_HOST is required/,
  "sending still requires a host",
);

// Retry settings must not.
assert.deepEqual(loadEmailRetrySettings({}), {
  retryBaseSeconds: 60,
  retryMaxSeconds: 3600,
});

assert.deepEqual(
  loadEmailRetrySettings({
    EMAIL_DELIVERY_RETRY_BASE_SECONDS: "30",
    EMAIL_DELIVERY_RETRY_MAX_SECONDS: "900",
  }),
  { retryBaseSeconds: 30, retryMaxSeconds: 900 },
);

// Values that cannot be used fall back rather than throwing: a failed delivery
// still has to be recorded.
assert.deepEqual(
  loadEmailRetrySettings({
    EMAIL_DELIVERY_RETRY_BASE_SECONDS: "not-a-number",
    EMAIL_DELIVERY_RETRY_MAX_SECONDS: "-5",
  }),
  { retryBaseSeconds: 60, retryMaxSeconds: 3600 },
);

// And it agrees with the full config when SMTP IS present, so the split did not
// change behaviour for a configured deployment.
const configured = loadEmailConfig({
  EMAIL_SMTP_HOST: "smtp.example.com",
  EMAIL_DELIVERY_RETRY_BASE_SECONDS: "45",
  EMAIL_DELIVERY_RETRY_MAX_SECONDS: "1800",
});
const split = loadEmailRetrySettings({
  EMAIL_DELIVERY_RETRY_BASE_SECONDS: "45",
  EMAIL_DELIVERY_RETRY_MAX_SECONDS: "1800",
});

assert.equal(configured.retryBaseSeconds, split.retryBaseSeconds);
assert.equal(configured.retryMaxSeconds, split.retryMaxSeconds);

console.log("email retry smoke passed.");
