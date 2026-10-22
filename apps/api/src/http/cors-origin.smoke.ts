import assert from "node:assert/strict";

import { createApiApp } from "../app.js";
import {
  isUnsafeRequestOriginAllowed,
  resolveCredentialedCorsOrigin,
  resolvePublicRequestOrigin,
} from "./cors-origin.js";

const allowedOrigins = [
  "https://cleanhub.example.test",
  "https://pos.cleanhub.example.test",
];
const mobileNativeOrigins = ["https://localhost"];

assert.equal(
  resolveCredentialedCorsOrigin({
    origin: "https://pos.cleanhub.example.test",
    allowedOrigins,
    enforceSameOrigin: true,
    requestUrl: "http://api:4000/pos/orders",
    forwardedProto: "https",
    forwardedHost: "pos.cleanhub.example.test",
  }),
  "https://pos.cleanhub.example.test",
  "the POS origin may call its own same-origin API proxy",
);
assert.equal(
  resolveCredentialedCorsOrigin({
    origin: "https://pos.cleanhub.example.test",
    allowedOrigins,
    enforceSameOrigin: true,
    requestUrl: "http://api:4000/tenant/profile",
    forwardedProto: "https",
    forwardedHost: "cleanhub.example.test",
  }),
  null,
  "the POS origin must not use credentialed CORS against the admin origin",
);
assert.equal(
  resolveCredentialedCorsOrigin({
    origin: "https://localhost",
    allowedOrigins: [...allowedOrigins, "https://localhost"],
    mobileNativeOrigins,
    authClient: "mobile",
    enforceSameOrigin: true,
    requestUrl: "http://api:4000/mobile/customer/orders",
    forwardedProto: "https",
    forwardedHost: "api.cleanhub.example.test",
  }),
  "https://localhost",
  "a Capacitor mobile bundle may use its explicit native origin",
);
assert.equal(
  resolveCredentialedCorsOrigin({
    origin: "https://localhost",
    allowedOrigins: [...allowedOrigins, "https://localhost"],
    mobileNativeOrigins,
    enforceSameOrigin: true,
    requestUrl: "http://api:4000/mobile/customer/orders",
    forwardedProto: "https",
    forwardedHost: "api.cleanhub.example.test",
  }),
  null,
  "the native origin still requires the mobile client marker",
);
assert.equal(
  resolveCredentialedCorsOrigin({
    origin: "http://localhost:3001",
    allowedOrigins: ["http://localhost:3000", "http://localhost:3001"],
    enforceSameOrigin: false,
    requestUrl: "http://localhost:4000/pos/orders",
  }),
  "http://localhost:3001",
  "development keeps its explicit multi-port CORS allowlist",
);
assert.equal(
  resolveCredentialedCorsOrigin({
    origin: "https://attacker.example.test",
    allowedOrigins,
    enforceSameOrigin: false,
    requestUrl: "http://localhost:4000/pos/orders",
  }),
  null,
  "an origin outside the allowlist remains rejected",
);
assert.equal(
  resolvePublicRequestOrigin({
    requestUrl: "http://api:4000/health",
    forwardedProto: "https, http",
    forwardedHost: "pos.cleanhub.example.test, proxy.internal",
  }),
  "https://pos.cleanhub.example.test",
  "the first trusted reverse-proxy origin is used",
);

assert.equal(
  isUnsafeRequestOriginAllowed({
    method: "POST",
    origin: "https://pos.cleanhub.example.test",
    allowedOrigins,
    enforceSameOrigin: true,
    requestUrl: "http://api:4000/auth/logout",
    forwardedProto: "https",
    forwardedHost: "cleanhub.example.test",
    secFetchSite: "same-site",
  }),
  false,
  "a sibling POS origin cannot execute a form-compatible admin mutation",
);
assert.equal(
  isUnsafeRequestOriginAllowed({
    method: "PATCH",
    origin: "https://pos.cleanhub.example.test",
    allowedOrigins,
    enforceSameOrigin: true,
    requestUrl: "http://api:4000/pos/settings",
    forwardedProto: "https",
    forwardedHost: "pos.cleanhub.example.test",
    secFetchSite: "same-origin",
  }),
  true,
  "same-origin unsafe requests remain allowed",
);
assert.equal(
  isUnsafeRequestOriginAllowed({
    method: "POST",
    origin: "https://localhost",
    allowedOrigins: [...allowedOrigins, "https://localhost"],
    mobileNativeOrigins,
    authClient: "mobile",
    enforceSameOrigin: true,
    requestUrl: "http://api:4000/mobile/auth/customer/refresh",
    forwardedProto: "https",
    forwardedHost: "api.cleanhub.example.test",
    secFetchSite: "cross-site",
  }),
  true,
  "a marked Capacitor client may make its bearer-token writes",
);
assert.equal(
  isUnsafeRequestOriginAllowed({
    method: "DELETE",
    origin: undefined,
    allowedOrigins,
    enforceSameOrigin: true,
    requestUrl: "http://api:4000/auth/session",
    forwardedProto: "https",
    forwardedHost: "cleanhub.example.test",
    secFetchSite: "cross-site",
  }),
  false,
  "Fetch Metadata blocks browser mutations that omit Origin",
);
assert.equal(
  isUnsafeRequestOriginAllowed({
    method: "POST",
    origin: undefined,
    allowedOrigins,
    enforceSameOrigin: true,
    requestUrl: "http://api:4000/internal/job",
  }),
  true,
  "internal server calls without browser headers or forwarded public host remain allowed",
);
assert.equal(
  isUnsafeRequestOriginAllowed({
    method: "POST",
    origin: "http://localhost:3001",
    allowedOrigins: ["http://localhost:3000", "http://localhost:3001"],
    enforceSameOrigin: false,
    requestUrl: "http://localhost:4000/auth/login",
    secFetchSite: "same-site",
  }),
  true,
  "development keeps its explicit multi-port workflow",
);

const developmentPosOrigin = "http://localhost:3001";
const { app } = createApiApp({
  env: {
    ...process.env,
    NODE_ENV: "development",
    AUTH_COOKIE_SECURE: "false",
    AUTH_TOKEN_SECRET:
      "cors-smoke-auth-secret-must-be-at-least-thirty-two-characters",
    CORS_ENFORCE_SAME_ORIGIN: "false",
    CORS_ORIGINS: `http://localhost:3000,${developmentPosOrigin}`,
  },
});
const idempotentPreflight = await app.request(
  "http://localhost:4000/pos/orders",
  {
    method: "OPTIONS",
    headers: {
      origin: developmentPosOrigin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type,idempotency-key",
    },
  },
);
assert.equal(
  idempotentPreflight.status,
  204,
  "the development POS idempotent write preflight must be accepted",
);
const allowedRequestHeaders =
  idempotentPreflight.headers
    .get("access-control-allow-headers")
    ?.toLowerCase()
    .split(",")
    .map((header) => header.trim()) ?? [];
assert.ok(
  allowedRequestHeaders.includes("idempotency-key"),
  "POS offline replay requires Idempotency-Key in CORS allowHeaders",
);

console.log("Credentialed CORS origin smoke passed.");
