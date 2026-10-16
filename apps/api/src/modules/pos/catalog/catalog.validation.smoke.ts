import assert from "node:assert/strict";

import { posCatalogQuerySchema } from "./catalog.validation.js";

const fullCatalogQuery = posCatalogQuerySchema.parse({
  branchId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  includeAll: "true",
});

assert.equal(fullCatalogQuery.includeAll, true);
assert.equal(fullCatalogQuery.limit, 100);
assert.throws(() => posCatalogQuerySchema.parse({ includeAll: "false" }));

console.log("POS catalog validation smoke passed.");
