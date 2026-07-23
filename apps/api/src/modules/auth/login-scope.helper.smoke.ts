import assert from "node:assert/strict";

import { resolveLoginScope } from "./login-scope.helper.js";

export function runLoginScopeHelperSmoke(): void {
  assert.deepEqual(resolveLoginScope(), {
    tenantCode: undefined,
    userType: "saas",
  });
  assert.deepEqual(resolveLoginScope("   "), {
    tenantCode: undefined,
    userType: "saas",
  });
  assert.deepEqual(resolveLoginScope(" clean-001 "), {
    tenantCode: "CLEAN-001",
    userType: "tenant",
  });
}

if (process.argv[1]?.endsWith("login-scope.helper.smoke.ts")) {
  runLoginScopeHelperSmoke();
  process.stdout.write("login scope helper smoke passed\n");
}
