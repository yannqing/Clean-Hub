import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import { proxy } from "./proxy.js";

/**
 * The proxy's job on an auth-backend failure is to do nothing: a 5xx or a
 * network error must not sign an admin out. Everything here drives the real
 * `proxy` with a stubbed `fetch`, because the bug being guarded is entirely in
 * how a failed response is classified.
 */

const ACCESS_COOKIE = "cleanhub_access_token";
const REFRESH_COOKIE = "cleanhub_refresh_token";

const originalFetch = globalThis.fetch;

function createRequest(pathname: string, cookies: string): NextRequest {
  return new NextRequest(`https://admin.test${pathname}`, {
    headers: { cookie: cookies },
  });
}

function stubFetch(responder: () => Promise<Response> | Response): void {
  globalThis.fetch = (async () => responder()) as typeof globalThis.fetch;
}

function authenticatedCookies(): string {
  return `${ACCESS_COOKIE}=access-token; ${REFRESH_COOKIE}=refresh-token`;
}

function okAuthResponse(role: string, tenantId: string | null): Response {
  return new Response(
    JSON.stringify({
      userId: "user-1",
      tenantId,
      branchIds: [],
      role,
      roles: [role],
      permissions: [],
      accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

async function run(): Promise<void> {
  // A 500 from /auth/me must leave the request untouched rather than redirect.
  stubFetch(() => new Response("upstream boom", { status: 500 }));
  let response = await proxy(createRequest("/tenant", authenticatedCookies()));
  assert.equal(
    response.headers.get("location"),
    null,
    "a 5xx from the auth backend must not redirect the admin to /login",
  );
  assert.ok(
    response.status < 300 || response.status >= 400,
    "a 5xx from the auth backend must not produce a redirect status",
  );

  // Same for a network-level failure.
  globalThis.fetch = (async () => {
    throw new Error("ECONNREFUSED");
  }) as typeof globalThis.fetch;
  response = await proxy(createRequest("/saas", authenticatedCookies()));
  assert.equal(
    response.headers.get("location"),
    null,
    "an unreachable auth backend must not redirect the admin to /login",
  );

  // A genuine 401 still signs the user out -- "unavailable" must not swallow
  // real rejections.
  stubFetch(() => new Response("nope", { status: 401 }));
  response = await proxy(createRequest("/tenant", authenticatedCookies()));
  assert.match(
    response.headers.get("location") ?? "",
    /\/login/,
    "an authentication failure must still redirect to /login",
  );

  // A healthy tenant session passes through.
  stubFetch(() => okAuthResponse("owner", "tenant-1"));
  response = await proxy(createRequest("/tenant", authenticatedCookies()));
  assert.equal(
    response.headers.get("location"),
    null,
    "an owner must reach /tenant without a redirect",
  );

  // Role separation still holds: a tenant owner may not enter /saas.
  stubFetch(() => okAuthResponse("owner", "tenant-1"));
  response = await proxy(createRequest("/saas", authenticatedCookies()));
  assert.match(
    response.headers.get("location") ?? "",
    /\/tenant/,
    "a tenant role must be redirected away from /saas",
  );

  // And a platform role may not enter /tenant.
  stubFetch(() => okAuthResponse("super_admin", null));
  response = await proxy(createRequest("/tenant", authenticatedCookies()));
  assert.match(
    response.headers.get("location") ?? "",
    /\/saas/,
    "a platform role must be redirected away from /tenant",
  );

  globalThis.fetch = originalFetch;
  console.log("web-admin proxy smoke passed.");
}

run().catch((error: unknown) => {
  globalThis.fetch = originalFetch;
  console.error(error);
  process.exitCode = 1;
});
