import assert from "node:assert/strict";

import {
  posMobileOverflowNavigation,
  posMobilePrimaryNavigation,
  posRoutes,
  posSidebarNavigation,
} from "@/config";

assert.equal(
  posMobilePrimaryNavigation.length,
  4,
  "mobile navigation must reserve the fifth tab for More",
);
assert.deepEqual(
  posMobilePrimaryNavigation.map((item) => item.href),
  [
    posRoutes.workspace,
    posRoutes.sale,
    posRoutes.newIntake,
    posRoutes.tickets,
  ],
);
assert.deepEqual(
  new Set([
    ...posMobilePrimaryNavigation,
    ...posMobileOverflowNavigation,
  ]),
  new Set(posSidebarNavigation),
  "every desktop sidebar item must remain reachable on mobile",
);

console.log("POS responsive navigation smoke passed.");
