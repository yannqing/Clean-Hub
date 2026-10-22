import assert from "node:assert/strict";

import {
  decryptPaymentCredentials,
  encryptPaymentCredentials,
} from "./payment-integrations.crypto.js";
import { TenantPaymentIntegrationError } from "./payment-integrations.errors.js";
import { verifyPaymentCredentials } from "./payment-integrations.provider.js";
import type { TenantPaymentCredentials } from "./payment-integrations.types.js";

const encryptionEnv = {
  NODE_ENV: "test",
  PAYMENT_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
} as NodeJS.ProcessEnv;

const waveCredentials = {
  provider: "wave",
  apiKey: "wave_sn_prod_example_secret_api_key",
  signingSecret: "wave_sn_AKS_example_signing_secret",
} satisfies TenantPaymentCredentials;

const ciphertext = encryptPaymentCredentials(
  "01TENANT000000000000000001",
  waveCredentials,
  encryptionEnv,
);
assert.equal(ciphertext.includes(waveCredentials.apiKey), false);
assert.deepEqual(
  decryptPaymentCredentials(
    "01TENANT000000000000000001",
    "wave",
    ciphertext,
    encryptionEnv,
  ),
  waveCredentials,
);
assert.throws(
  () =>
    decryptPaymentCredentials(
      "01TENANT000000000000000002",
      "wave",
      ciphertext,
      encryptionEnv,
    ),
  TenantPaymentIntegrationError,
);
assert.throws(
  () =>
    encryptPaymentCredentials("01TENANT000000000000000001", waveCredentials, {
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv),
  (error: unknown) =>
    error instanceof TenantPaymentIntegrationError &&
    error.code === "PAYMENT_CREDENTIAL_ENCRYPTION_NOT_CONFIGURED",
);

let waveRequest: { input: string; init?: RequestInit } | undefined;
const waveResult = await verifyPaymentCredentials(waveCredentials, (async (
  input: string | URL | Request,
  init?: RequestInit,
) => {
  waveRequest = { input: String(input), init };
  return new Response(JSON.stringify({ result: [] }), { status: 200 });
}) as typeof fetch);
assert.equal(waveResult.valid, true);
assert.match(
  waveRequest?.input ?? "",
  /api\.wave\.com\/v1\/checkout\/sessions\/search/,
);
const waveHeaders = new Headers(waveRequest?.init?.headers);
assert.equal(
  waveHeaders.get("authorization"),
  `Bearer ${waveCredentials.apiKey}`,
);
assert.match(waveHeaders.get("wave-signature") ?? "", /^t=\d+,v1=[a-f\d]{64}$/);

const orangeCredentials = {
  provider: "orange_money",
  clientId: "orange-client-id",
  clientSecret: "orange-client-secret",
  merchantKey: "orange-merchant-key",
} satisfies TenantPaymentCredentials;
let orangeRequest: { input: string; init?: RequestInit } | undefined;
const orangeResult = await verifyPaymentCredentials(orangeCredentials, (async (
  input: string | URL | Request,
  init?: RequestInit,
) => {
  orangeRequest = { input: String(input), init };
  return new Response(JSON.stringify({ access_token: "verified-token" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch);
assert.equal(orangeResult.valid, true);
assert.equal(orangeRequest?.input, "https://api.orange.com/oauth/v3/token");
assert.equal(orangeRequest?.init?.body, "grant_type=client_credentials");
assert.equal(
  new Headers(orangeRequest?.init?.headers).get("authorization"),
  `Basic ${Buffer.from(`${orangeCredentials.clientId}:${orangeCredentials.clientSecret}`).toString("base64")}`,
);

const rejectedResult = await verifyPaymentCredentials(
  orangeCredentials,
  (async () => new Response(null, { status: 401 })) as typeof fetch,
);
assert.equal(rejectedResult.valid, false);
assert.equal(
  rejectedResult.message.includes(orangeCredentials.clientSecret),
  false,
);

console.log("tenant payment integration security smoke tests passed");
