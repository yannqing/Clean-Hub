import assert from "node:assert/strict";

import { shouldAcceptPosCartUpdate } from "./carts.service.js";

assert.equal(
  shouldAcceptPosCartUpdate(null, "2026-01-01T00:00:00.000Z"),
  true,
  "the first cloud save must be accepted",
);
assert.equal(
  shouldAcceptPosCartUpdate(
    "2026-01-01T00:00:00.000Z",
    "2026-01-02T00:00:00.000Z",
  ),
  true,
  "newer cross-terminal work must replace the cloud cart",
);
assert.equal(
  shouldAcceptPosCartUpdate(
    "2026-01-02T00:00:00.000Z",
    "2026-01-01T00:00:00.000Z",
  ),
  false,
  "an offline stale cart must not overwrite newer cloud work",
);

console.log("POS cart cloud conflict smoke passed.");
