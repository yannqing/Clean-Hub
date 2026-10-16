import { ApiHttpError } from "@cleanhub/api-client";

import { isPosTerminalSessionError } from "./pos-terminal-session";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function httpError(status: number, code: string): ApiHttpError {
  return new ApiHttpError({
    message: code,
    status,
    statusText: status === 403 ? "Forbidden" : "Unauthorized",
    method: "GET",
    url: "https://pos.example.test/pos/orders",
    code,
  });
}

for (const code of [
  "POS_TERMINAL_DISABLED",
  "POS_TERMINAL_CREDENTIAL_INVALID",
  "POS_TERMINAL_ENROLLMENT_REQUIRED",
]) {
  assert(
    isPosTerminalSessionError(httpError(403, code)),
    `${code} must invalidate the local POS session`,
  );
}

assert(
  !isPosTerminalSessionError(httpError(401, "POS_TERMINAL_DISABLED")),
  "only the three terminal 403 responses use the global invalidation path",
);
assert(
  !isPosTerminalSessionError(httpError(403, "FORBIDDEN")),
  "ordinary permission failures must not sign the terminal out",
);
assert(
  !isPosTerminalSessionError(new Error("network unavailable")),
  "network failures must not invalidate terminal enrollment",
);

console.log("POS terminal session guard smoke ok");
