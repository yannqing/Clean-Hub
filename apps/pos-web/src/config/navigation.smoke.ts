import assert from "node:assert/strict";

import {
  buildNewIntakePath,
  posMobileOverflowNavigation,
  posMobilePrimaryNavigation,
  posRoutes,
  posSidebarNavigation,
} from "@/config";

assert.equal(buildNewIntakePath(), posRoutes.newIntake);
assert.equal(
  buildNewIntakePath({ query: "张 三", serviceId: "service/001" }),
  "/new-intake?q=%E5%BC%A0+%E4%B8%89&serviceId=service%2F001",
  "intake navigation must preserve both the customer query and selected service",
);
assert.equal(
  posRoutes.newIntakeForService("service/001"),
  "/new-intake?serviceId=service%2F001",
);

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
