import assert from "node:assert/strict";

import { MediaError } from "../../media/index.js";
import { mapProductMediaError } from "./products.service.js";
import {
  createTenantProductBodySchema,
  requestTenantProductMediaDownloadsBodySchema,
  requestTenantProductMediaUploadBodySchema,
  tenantProductParamsSchema,
  updateTenantProductBodySchema,
} from "./products.validation.js";

const BRANCH_A = "01KRERJN800000000000000001";
const BRANCH_B = "01KRERJN810000000000000002";
const CATEGORY_A = "01KRERJN820000000000000003";
const DEFINITION_A = "01KRERJN830000000000000004";
const OPTION_A = "01KRERJN840000000000000005";
const OPTION_B = "01KRERJN850000000000000006";
const PRODUCT_A = "01KRERJN860000000000000007";
const SKU_A = "01KRERJN870000000000000008";
const MEDIA_A = "01KRERJN880000000000000009";

function validProductBody() {
  return {
    name: "Product",
    categoryAttributes: [],
    tags: [],
    status: "active",
    skuCode: "SKU-1",
    unitOfMeasure: "piece",
    unitsPerSale: "1",
    salePrice: "10.00",
    currency: "CNY",
    trackInventory: true,
    allowNegativeStock: false,
    allowOfflineSale: false,
    branchSettings: [
      {
        branchId: BRANCH_A,
        openingStock: "2",
        reorderPoint: "1",
      },
      {
        branchId: BRANCH_B,
        openingStock: "8",
        reorderPoint: "3",
      },
    ],
    mediaObjectKeys: [
      `tenant/${BRANCH_A}/product_image/unassigned/image-1.jpg`,
      `tenant/${BRANCH_A}/product_image/unassigned/image-2.jpg`,
    ],
  };
}

function validUpdateBody() {
  const product = validProductBody();

  return {
    version: 1,
    skuId: SKU_A,
    skuVersion: 1,
    name: product.name,
    categoryAttributes: product.categoryAttributes,
    tags: product.tags,
    status: product.status,
    skuCode: product.skuCode,
    unitOfMeasure: product.unitOfMeasure,
    unitsPerSale: product.unitsPerSale,
    salePrice: product.salePrice,
    currency: product.currency,
    trackInventory: product.trackInventory,
    allowNegativeStock: product.allowNegativeStock,
    allowOfflineSale: product.allowOfflineSale,
    branchSettings: product.branchSettings.map((setting) => ({
      branchId: setting.branchId,
      expectedStockOnHand: setting.openingStock,
      stockOnHand: setting.openingStock,
      reorderPoint: setting.reorderPoint,
    })),
    retainedMediaIds: [MEDIA_A],
    newMediaObjectKeys: [product.mediaObjectKeys[0]!],
  };
}

export function runTenantProductValidationSmokeChecks(): void {
  const mediaConflict = mapProductMediaError(
    new MediaError(
      "MEDIA_CONFLICT",
      "Media object has already been committed.",
      409,
    ),
  );
  assert.equal(mediaConflict.code, "PRODUCT_MEDIA_CONFLICT");
  assert.equal(mediaConflict.status, 409);

  const parsed = createTenantProductBodySchema.parse(validProductBody());

  assert.deepEqual(
    parsed.branchSettings.map((setting) => setting.openingStock),
    ["2", "8"],
    "per-branch opening stock must be preserved",
  );

  const legacyBody = validProductBody();
  delete (legacyBody as Partial<typeof legacyBody>).categoryAttributes;
  const parsedLegacyBody = createTenantProductBodySchema.parse(legacyBody);
  assert.deepEqual(
    parsedLegacyBody.categoryAttributes,
    [],
    "older clients that omit category attributes must default to an empty list",
  );

  const categoryAttributesBody = {
    ...validProductBody(),
    categoryId: CATEGORY_A,
    categoryAttributes: [
      {
        definitionId: DEFINITION_A,
        optionIds: [OPTION_A, OPTION_B],
      },
    ],
  };
  assert.equal(
    createTenantProductBodySchema.safeParse(categoryAttributesBody).success,
    true,
    "an existing category may receive structured attributes",
  );

  const categoryNameConflictBody = {
    ...categoryAttributesBody,
    categoryName: "Apparel",
  };
  assert.equal(
    createTenantProductBodySchema.safeParse(categoryNameConflictBody).success,
    false,
    "category ID and category name are mutually exclusive",
  );

  const attributesWithoutCategoryBody = {
    ...validProductBody(),
    categoryAttributes: categoryAttributesBody.categoryAttributes,
  };
  assert.equal(
    createTenantProductBodySchema.safeParse(attributesWithoutCategoryBody)
      .success,
    false,
    "structured attributes require an existing category ID",
  );

  const duplicateDefinitionsBody = {
    ...categoryAttributesBody,
    categoryAttributes: [
      categoryAttributesBody.categoryAttributes[0],
      categoryAttributesBody.categoryAttributes[0],
    ],
  };
  assert.equal(
    createTenantProductBodySchema.safeParse(duplicateDefinitionsBody).success,
    false,
    "a category attribute definition may only be submitted once",
  );

  const duplicateOptionsBody = {
    ...categoryAttributesBody,
    categoryAttributes: [
      {
        definitionId: DEFINITION_A,
        optionIds: [OPTION_A, OPTION_A],
      },
    ],
  };
  assert.equal(
    createTenantProductBodySchema.safeParse(duplicateOptionsBody).success,
    false,
    "an attribute option may only be submitted once",
  );

  const tooManyAttributesBody = {
    ...validProductBody(),
    categoryId: CATEGORY_A,
    categoryAttributes: Array.from({ length: 31 }, (_, index) => ({
      definitionId: `01KRERJN83${index.toString().padStart(16, "0")}`,
      optionIds: [OPTION_A],
    })),
  };
  assert.equal(
    createTenantProductBodySchema.safeParse(tooManyAttributesBody).success,
    false,
    "a product cannot submit more than thirty category attributes",
  );

  const duplicateBranchBody = validProductBody();
  duplicateBranchBody.branchSettings[1] = {
    ...duplicateBranchBody.branchSettings[0]!,
  };
  assert.equal(
    createTenantProductBodySchema.safeParse(duplicateBranchBody).success,
    false,
    "a branch may only appear once",
  );

  const untrackedStockBody = validProductBody();
  untrackedStockBody.trackInventory = false;
  assert.equal(
    createTenantProductBodySchema.safeParse(untrackedStockBody).success,
    false,
    "untracked products cannot receive stock or reorder points",
  );

  const untrackedNegativeStockBody = validProductBody();
  untrackedNegativeStockBody.trackInventory = false;
  untrackedNegativeStockBody.allowNegativeStock = true;
  untrackedNegativeStockBody.branchSettings =
    untrackedNegativeStockBody.branchSettings.map((setting) => ({
      ...setting,
      openingStock: "0",
      reorderPoint: "0",
    }));
  assert.equal(
    createTenantProductBodySchema.safeParse(untrackedNegativeStockBody).success,
    false,
    "untracked products cannot enable negative stock",
  );

  const duplicateMediaBody = validProductBody();
  duplicateMediaBody.mediaObjectKeys = [
    duplicateMediaBody.mediaObjectKeys[0]!,
    duplicateMediaBody.mediaObjectKeys[0]!,
  ];
  assert.equal(
    createTenantProductBodySchema.safeParse(duplicateMediaBody).success,
    false,
    "a media object cannot be attached more than once",
  );

  const tooManyMediaBody = validProductBody();
  tooManyMediaBody.mediaObjectKeys = Array.from(
    { length: 11 },
    (_, index) =>
      `tenant/${BRANCH_A}/product_image/unassigned/image-${index}.jpg`,
  );
  assert.equal(
    createTenantProductBodySchema.safeParse(tooManyMediaBody).success,
    false,
    "a product cannot attach more than ten images",
  );

  assert.equal(
    requestTenantProductMediaUploadBodySchema.safeParse({
      contentType: "image/webp",
      sizeBytes: 5 * 1_024 * 1_024,
    }).success,
    true,
  );
  assert.equal(
    requestTenantProductMediaUploadBodySchema.safeParse({
      contentType: "image/gif",
      sizeBytes: 128,
    }).success,
    false,
  );
  assert.equal(
    requestTenantProductMediaUploadBodySchema.safeParse({
      contentType: "image/jpeg",
      sizeBytes: 5 * 1_024 * 1_024 + 1,
    }).success,
    false,
  );
  assert.equal(
    requestTenantProductMediaDownloadsBodySchema.safeParse({
      items: [{ productId: PRODUCT_A, mediaId: MEDIA_A }],
    }).success,
    true,
  );
  assert.equal(
    requestTenantProductMediaDownloadsBodySchema.safeParse({
      items: [
        { productId: PRODUCT_A, mediaId: MEDIA_A },
        { productId: PRODUCT_A, mediaId: MEDIA_A },
      ],
    }).success,
    false,
    "product media download items must be unique",
  );

  const updateBody = validUpdateBody();
  const parsedUpdate = updateTenantProductBodySchema.parse(updateBody);
  assert.deepEqual(
    parsedUpdate.branchSettings.map((setting) => setting.stockOnHand),
    ["2", "8"],
    "product updates must preserve each branch's target stock on hand",
  );

  assert.equal(
    updateTenantProductBodySchema.safeParse({
      ...updateBody,
      version: 0,
    }).success,
    false,
    "product updates require a positive optimistic-lock version",
  );
  assert.equal(
    updateTenantProductBodySchema.safeParse({
      ...updateBody,
      retainedMediaIds: [MEDIA_A, MEDIA_A],
    }).success,
    false,
    "retained product media IDs must be unique",
  );
  assert.equal(
    updateTenantProductBodySchema.safeParse({
      ...updateBody,
      retainedMediaIds: Array.from(
        { length: 10 },
        (_, index) => `01KRERJN88${index.toString().padStart(16, "0")}`,
      ),
      newMediaObjectKeys: [updateBody.newMediaObjectKeys[0]!],
    }).success,
    false,
    "retained and newly uploaded media share the ten-image limit",
  );
  assert.equal(
    updateTenantProductBodySchema.safeParse({
      ...updateBody,
      trackInventory: false,
    }).success,
    false,
    "untracked product updates cannot submit target stock or reorder points",
  );
  assert.equal(
    tenantProductParamsSchema.safeParse({ productId: PRODUCT_A }).success,
    true,
  );
  assert.equal(
    tenantProductParamsSchema.safeParse({ productId: "not-a-product-id" })
      .success,
    false,
  );
}

if (process.argv[1]?.endsWith("products.validation.smoke.ts")) {
  runTenantProductValidationSmokeChecks();
}
