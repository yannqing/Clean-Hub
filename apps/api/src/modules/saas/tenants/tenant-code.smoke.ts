import assert from "node:assert/strict";

import { generateTenantCode } from "./tenant-code.helper.js";
import { createSaasTenantBodySchema } from "./tenants.validation.js";

const createRequest = { name: "Test tenant", country: "SN" };

assert.equal(createSaasTenantBodySchema.parse(createRequest).pressingCode, undefined);
assert.equal(
  createSaasTenantBodySchema.parse({ ...createRequest, pressingCode: "EXISTING1" }).pressingCode,
  "EXISTING1",
);
assert.equal(
  createSaasTenantBodySchema.safeParse({ ...createRequest, pressingCode: "" }).success,
  false,
);

for (let index = 0; index < 100; index += 1) {
  assert.match(generateTenantCode(), /^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{10}$/);
}

console.log("Tenant code generation smoke passed.");
