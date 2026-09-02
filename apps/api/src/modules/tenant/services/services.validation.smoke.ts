import assert from "node:assert/strict";

import {
  createServiceBodySchema,
  requestTenantServiceMediaDownloadsBodySchema,
  requestTenantServiceMediaUploadBodySchema,
  updateServiceBodySchema,
} from "./services.validation.js";

const CATEGORY_ID = "01KRERJN820000000000000003";
const BRANCH_ID = "01KRERJN8G0000000000000040";

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
    allBranches: false,
    branchSettings: [
      {
        branchId: BRANCH_ID,
        isAvailable: true,
        priceOverrideAmount: "45.00",
        turnaroundMinutesOverride: 720,
      },
    ],
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
  assert.equal(parsed.allBranches, false);
  assert.equal(parsed.branchSettings?.[0]?.priceOverrideAmount, "45.00");

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

  assert.equal(
    createServiceBodySchema.safeParse({
      ...validServiceBody(),
      branchSettings: [],
    }).success,
    false,
    "specific-location services require at least one available branch",
  );

  assert.equal(
    createServiceBodySchema.safeParse({
      ...validServiceBody(),
      branchSettings: [
        {
          branchId: BRANCH_ID,
          isAvailable: true,
          priceOverrideAmount: "0",
        },
      ],
    }).success,
    false,
    "branch price overrides must be positive",
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

  assert.equal(
    createServiceBodySchema.safeParse({
      ...validServiceBody(),
      mediaObjectKeys: Array.from(
        { length: 11 },
        (_, index) => `tenant/service-image-${index}`,
      ),
    }).success,
    false,
    "a service can contain at most ten images",
  );

  assert.equal(
    updateServiceBodySchema.safeParse({
      version: 2,
      retainedMediaIds: Array.from(
        { length: 6 },
        (_, index) => `01KRERJN8G00000000000000${index}`,
      ),
      newMediaObjectKeys: Array.from(
        { length: 5 },
        (_, index) => `tenant/new-service-image-${index}`,
      ),
    }).success,
    false,
    "retained and new service images share the ten-image limit",
  );

  assert.equal(
    requestTenantServiceMediaUploadBodySchema.safeParse({
      contentType: "image/webp",
      sizeBytes: 5 * 1_024 * 1_024,
    }).success,
    true,
    "supported service images can request an upload ticket",
  );

  assert.equal(
    requestTenantServiceMediaUploadBodySchema.safeParse({
      contentType: "image/gif",
      sizeBytes: 1_024,
    }).success,
    false,
    "unsupported service image formats are rejected",
  );

  assert.equal(
    requestTenantServiceMediaDownloadsBodySchema.safeParse({
      items: [{ serviceId: CATEGORY_ID, mediaId: BRANCH_ID }],
    }).success,
    true,
    "a service cover image can request a download link",
  );

  assert.equal(
    requestTenantServiceMediaDownloadsBodySchema.safeParse({
      items: [
        { serviceId: CATEGORY_ID, mediaId: BRANCH_ID },
        { serviceId: CATEGORY_ID, mediaId: BRANCH_ID },
      ],
    }).success,
    false,
    "duplicate service media download pairs are rejected",
  );
}

if (process.argv[1]?.endsWith("services.validation.smoke.ts")) {
  runTenantServiceValidationSmokeChecks();
}
