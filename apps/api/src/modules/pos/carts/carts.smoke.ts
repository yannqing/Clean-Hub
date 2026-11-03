import assert from "node:assert/strict";

import {
  clampClientTimestampToServer,
  shouldAcceptPosCartUpdate,
} from "./carts.service.js";

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

// A terminal whose clock runs fast must not be able to bank a future
// timestamp: that would outrank every later save from a correctly-clocked
// terminal until real time caught up, silently dropping their work.
const serverNow = Date.parse("2026-01-01T12:00:00.000Z");
assert.equal(
  clampClientTimestampToServer("2026-01-01T12:04:00.000Z", serverNow),
  "2026-01-01T12:00:00.000Z",
  "a fast terminal's reading is pulled back to server time",
);
assert.equal(
  clampClientTimestampToServer("2026-01-01T11:59:00.000Z", serverNow),
  "2026-01-01T11:59:00.000Z",
  "a slow or on-time reading is left untouched",
);
assert.equal(
  clampClientTimestampToServer("2026-01-01T12:00:00.000Z", serverNow),
  "2026-01-01T12:00:00.000Z",
  "an exactly-current reading is left untouched",
);

// The skew scenario end to end: terminal A is 4 minutes fast (inside the
// 5-minute tolerance), terminal B is correct and saves one minute later.
// Before clamping, A's stored 12:04 beat B's 12:01 and B was rejected.
const fastTerminalStored = clampClientTimestampToServer(
  "2026-01-01T12:04:00.000Z",
  serverNow,
);
assert.equal(
  shouldAcceptPosCartUpdate(
    fastTerminalStored,
    clampClientTimestampToServer(
      "2026-01-01T12:01:00.000Z",
      Date.parse("2026-01-01T12:01:00.000Z"),
    ),
  ),
  true,
  "a correctly-clocked terminal's later save must still win",
);

console.log("POS cart cloud conflict smoke passed.");
