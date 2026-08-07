import assert from "node:assert/strict";

import {
  createServiceBodySchema,
  updateServiceBodySchema,
} from "./services.validation.js";

const CATEGORY_ID = "01KRERJN820000000000000003";

function validServiceBody() {
  return {
    businessLine: "laundry" as const,
    name: "Dry cleaning",
    code: " dry-clean-01 ",
    shortName: "Dry clean",
    categoryId: CATEGORY_ID,
    description: "Professional garment cleaning",
    internalNotes: "Inspect delicate trims before cleaning.",
    turnaroundMinutes: 1440,
    displayOrder: 10,
    pricingUnit: "per_item" as const,
    labelRule: "per_order_item" as const,
    standardPrice: "40.00",
    compareAtPrice: "50.00",
    costPrice: "18.50",
    status: "active" as const,
  };
}

export function runTenantServiceValidationSmokeChecks(): void {
  const parsed = createServiceBodySchema.parse(validServiceBody());

  assert.equal(parsed.code, "DRY-CLEAN-01");
  assert.equal(parsed.turnaroundMinutes, 1440);
  assert.equal(parsed.compareAtPrice, "50.00");
  assert.equal(parsed.costPrice, "18.50");

  assert.equal(
    createServiceBodySchema.safeParse({
      ...validServiceBody(),
      code: "invalid code",
    }).success,
    false,
    "service codes must remain POS and receipt safe",
  );

  assert.equal(
    createServiceBodySchema.safeParse({
      ...validServiceBody(),
      compareAtPrice: "39.99",
    }).success,
    false,
    "compare-at price must be higher than the standard price",
  );

  assert.equal(
    createServiceBodySchema.safeParse({
      ...validServiceBody(),
      costPrice: "0",
    }).success,
    false,
    "a supplied service cost must be positive",
  );

  assert.equal(
    createServiceBodySchema.safeParse({
      ...validServiceBody(),
      turnaroundMinutes: 525_601,
    }).success,
    false,
    "turnaround time is capped at one year",
  );

  const clearedOptionals = updateServiceBodySchema.parse({
    version: 2,
    code: null,
    shortName: null,
    internalNotes: null,
    turnaroundMinutes: null,
    compareAtPrice: null,
    costPrice: null,
  });

  assert.equal(clearedOptionals.code, null);
  assert.equal(clearedOptionals.compareAtPrice, null);

  assert.equal(
    updateServiceBodySchema.safeParse({ version: 2, currency: "USD" }).success,
    false,
    "service currency must be managed through tenant settings",
  );
}

if (process.argv[1]?.endsWith("services.validation.smoke.ts")) {
  runTenantServiceValidationSmokeChecks();
}
