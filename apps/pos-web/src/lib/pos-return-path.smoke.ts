import assert from "node:assert/strict";

import {
  buildPosLoginPath,
  resolveLockedPosReturnPath,
  resolvePosReturnPath,
} from "./pos-return-path";

const ticketPath = "/tickets/01SEED0100TKT0000000000014";

assert.equal(resolvePosReturnPath(ticketPath), ticketPath);
assert.equal(
  resolvePosReturnPath(`${ticketPath}?from=workspace#details`),
  `${ticketPath}?from=workspace#details`,
);
assert.equal(
  buildPosLoginPath(`${ticketPath}?from=workspace`),
  `/login?next=${encodeURIComponent(`${ticketPath}?from=workspace`)}`,
);
assert.equal(
  buildPosLoginPath(ticketPath, { locked: true }),
  `/login?next=${encodeURIComponent(ticketPath)}&locked=1`,
);

const lockingUserId = "01SEED00000000000000000001";
assert.equal(
  resolveLockedPosReturnPath(ticketPath, lockingUserId, {
    path: ticketPath,
    userId: lockingUserId,
  }),
  ticketPath,
  "the employee who locked the terminal returns to the original page",
);
assert.equal(
  resolveLockedPosReturnPath(ticketPath, "01SEED00000000000000000002", {
    path: ticketPath,
    userId: lockingUserId,
  }),
  "/",
  "a different employee must start from the POS workspace",
);
assert.equal(
  resolveLockedPosReturnPath(ticketPath, lockingUserId, {
    path: "/settings/security",
    userId: lockingUserId,
  }),
  "/",
  "the stored identity binding cannot be reused for another path",
);

for (const unsafePath of [
  null,
  "",
  "https://example.com/tickets/1",
  "//example.com/tickets/1",
  "/\\example.com/tickets/1",
  "/login",
  "/setup",
  "/setup/terminal",
]) {
  assert.equal(
    resolvePosReturnPath(unsafePath),
    "/",
    `${String(unsafePath)} must not be restored after PIN login`,
  );
}

console.log("POS lock-screen return path smoke ok");
