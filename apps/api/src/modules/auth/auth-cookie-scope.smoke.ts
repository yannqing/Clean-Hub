import assert from "node:assert/strict";

import {
  ACCESS_COOKIE_NAME,
  createAuthCookieHeaders,
  createClearAuthCookieHeaders,
  POS_ACCESS_COOKIE_NAME,
  POS_REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  resolveAuthCookieNames,
  scopeAuthCookieHeaders,
} from "./cookie.service.js";

const genericNames = resolveAuthCookieNames(undefined);
assert.deepEqual(genericNames, {
  access: ACCESS_COOKIE_NAME,
  refresh: REFRESH_COOKIE_NAME,
});

const posNames = resolveAuthCookieNames("POS");
assert.deepEqual(posNames, {
  access: POS_ACCESS_COOKIE_NAME,
  refresh: POS_REFRESH_COOKIE_NAME,
});

const authHeaders = createAuthCookieHeaders(
  {
    accessToken: "access-token",
    accessTokenExpiresAt: new Date(Date.now() + 60_000),
    refreshToken: "refresh-token",
    refreshTokenExpiresAt: new Date(Date.now() + 120_000),
    refreshTokenFamilyId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  },
  { secure: false },
);
const scopedAuthHeaders = scopeAuthCookieHeaders(authHeaders, "pos");

assert.match(scopedAuthHeaders[0] ?? "", /^cleanhub_pos_access_token=/);
assert.match(scopedAuthHeaders[1] ?? "", /^cleanhub_pos_refresh_token=/);
assert.ok(scopedAuthHeaders.every((header) => header.includes("HttpOnly")));
assert.ok(scopedAuthHeaders.every((header) => header.includes("Path=/")));

const scopedClearHeaders = scopeAuthCookieHeaders(
  createClearAuthCookieHeaders({ secure: false }),
  "pos",
);
assert.equal(scopedClearHeaders.length, 3);
assert.match(scopedClearHeaders[0] ?? "", /^cleanhub_pos_access_token=/);
assert.match(scopedClearHeaders[1] ?? "", /^cleanhub_pos_refresh_token=/);
assert.match(scopedClearHeaders[2] ?? "", /^cleanhub_pos_refresh_token=/);
assert.ok(
  scopedClearHeaders.every((header) => header.includes("Max-Age=0")),
);

console.log("auth cookie scope smoke passed");
