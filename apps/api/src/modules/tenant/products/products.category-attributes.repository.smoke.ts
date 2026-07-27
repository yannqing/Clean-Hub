import assert from "node:assert/strict";

import "../../../config/env.js";

import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  auditLogs,
  branchProductSettings,
  branches,
  closeDbConnection,
  getDb,
  inventoryBalances,
  inventoryMovements,
  mediaObjects,
  productAttributeValueOptions,
  productAttributeValues,
  productCategories,
  productCategoryAttributeDefinitions,
  productMedia,
  productPrices,
  products,
  productSkus,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import { TenantProductsError } from "./products.errors.js";
import {
  bootstrapDefaultProductCategoryMetadata,
  createTenantProductRecord,
  findTenantProductDetailRecord,
  findTenantProductCategories,
  findTenantProductCategoryAttributes,
  findTenantProductMediaRecords,
  findTenantProducts,
  updateTenantProductRecord,
} from "./products.repository.js";

export async function runTenantProductCategoryAttributeRepositorySmokeChecks(): Promise<void> {
  const db = getDb();
  const scopeRows = await db
    .select({
      tenantId: users.tenantId,
      actorUserId: users.id,
      branchId: branches.id,
    })
    .from(users)
    .innerJoin(
      branches,
      and(
        eq(branches.tenantId, users.tenantId),
        eq(branches.status, "active"),
        isNull(branches.deletedAt),
      ),
    )
    .where(
      and(
        eq(users.userType, "tenant"),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  const scope = scopeRows[0];

  assert.ok(
    scope?.tenantId,
    "category attribute smoke requires an active tenant user and branch",
  );

  await bootstrapDefaultProductCategoryMetadata(db, {
    tenantId: scope.tenantId,
    actorUserId: scope.actorUserId,
  });
  const firstCategoryList = await findTenantProductCategories(db, {
    tenantId: scope.tenantId,
  });

  await bootstrapDefaultProductCategoryMetadata(db, {
    tenantId: scope.tenantId,
    actorUserId: scope.actorUserId,
  });
  const secondCategoryList = await findTenantProductCategories(db, {
    tenantId: scope.tenantId,
  });

  assert.equal(
    secondCategoryList.data.length,
    firstCategoryList.data.length,
    "default category bootstrap must be idempotent",
  );

  const laundryCare = secondCategoryList.data.find(
    (category) => category.code === "laundry_care",
  );

  assert.ok(laundryCare, "default laundry care category must exist");

  const attributeResponse = await findTenantProductCategoryAttributes(db, {
    tenantId: scope.tenantId,
    categoryId: laundryCare.id,
  });
  const fabricSuitability = attributeResponse.data.find(
    (definition) => definition.code === "fabric_suitability",
  );
  const productType = attributeResponse.data.find(
    (definition) => definition.code === "product_type",
  );
  const usageInstructions = attributeResponse.data.find(
    (definition) => definition.code === "usage_instructions",
  );

  assert.equal(fabricSuitability?.valueType, "multi_select");
  assert.equal(productType?.valueType, "single_select");
  assert.equal(usageInstructions?.valueType, "text");
  assert.ok(fabricSuitability && fabricSuitability.options.length >= 2);
  assert.ok(productType && productType.options.length >= 1);
  assert.ok(usageInstructions);

  const productIdHolder: string[] = [];
  const mediaObjectIdHolder: string[] = [];
  const branchIdHolder: string[] = [];

  try {
    const result = await createTenantProductRecord(db, {
      tenantId: scope.tenantId,
      actorUserId: scope.actorUserId,
      createTenantDefaultPrice: true,
      name: `Category attribute smoke ${createId()}`,
      categoryId: laundryCare.id,
      categoryAttributes: [
        {
          definitionId: fabricSuitability.id,
          optionIds: [
            fabricSuitability.options[0]!.id,
            fabricSuitability.options[1]!.id,
          ],
        },
        {
          definitionId: productType.id,
          optionIds: [productType.options[0]!.id],
        },
        {
          definitionId: usageInstructions.id,
          textValue: "按包装说明添加适量产品",
        },
      ],
      tags: [],
      status: "active",
      skuCode: `ATTR-${createId()}`,
      unitOfMeasure: "piece",
      unitsPerSale: "1",
      salePrice: "99.00",
      currency: "CNY",
      referenceCost: null,
      trackInventory: true,
      allowNegativeStock: false,
      allowOfflineSale: false,
      branchSettings: [
        {
          branchId: scope.branchId,
          openingStock: "0",
          reorderPoint: "0",
        },
      ],
      mediaObjectKeys: [],
    });
    productIdHolder.push(result.id);

    const mediaObjectId = createId();
    mediaObjectIdHolder.push(mediaObjectId);
    await db.insert(mediaObjects).values({
      id: mediaObjectId,
      tenantId: scope.tenantId,
      objectKey: `tenant/${scope.tenantId}/product_image/unassigned/${createId()}.png`,
      contentType: "image/png",
      sizeBytes: 1,
      status: "committed",
      purpose: "product_image",
      createdBy: scope.actorUserId,
      committedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const productMediaId = createId();
    await db.insert(productMedia).values({
      id: productMediaId,
      tenantId: scope.tenantId,
      productId: result.id,
      mediaObjectId,
      isPrimary: true,
      sortOrder: 0,
      createdBy: scope.actorUserId,
    });

    const valueRows = await db
      .select({
        id: productAttributeValues.id,
        definitionId: productAttributeValues.definitionId,
        textValue: productAttributeValues.textValue,
      })
      .from(productAttributeValues)
      .where(
        and(
          eq(productAttributeValues.tenantId, scope.tenantId),
          eq(productAttributeValues.productId, result.id),
          isNull(productAttributeValues.deletedAt),
        ),
      );
    const valueIds = valueRows.map((value) => value.id);
    const selectedOptionRows = await db
      .select({ id: productAttributeValueOptions.id })
      .from(productAttributeValueOptions)
      .where(
        and(
          eq(productAttributeValueOptions.tenantId, scope.tenantId),
          inArray(productAttributeValueOptions.attributeValueId, valueIds),
          isNull(productAttributeValueOptions.deletedAt),
        ),
      );

    assert.equal(valueRows.length, 3);
    assert.equal(selectedOptionRows.length, 3);
    assert.equal(
      valueRows.find((value) => value.definitionId === usageInstructions.id)
        ?.textValue,
      "按包装说明添加适量产品",
    );

    const detail = await findTenantProductDetailRecord(db, {
      tenantId: scope.tenantId,
      productId: result.id,
      preferTenantDefaultPrice: true,
    });

    assert.ok(detail);
    assert.equal(detail.skuCount, 1);
    assert.equal(detail.salePrice, "99.00");
    assert.equal(detail.branchSettings[0]?.onHandQuantity, "0.000");
    assert.equal(detail.media[0]?.id, productMediaId);

    const productList = await findTenantProducts(db, {
      tenantId: scope.tenantId,
      limit: 100,
      offset: 0,
    });
    const productSummary = productList.data.find(
      (product) => product.id === result.id,
    );

    assert.deepEqual(productSummary?.primaryImage, {
      id: productMediaId,
    });

    const productMediaRecords = await findTenantProductMediaRecords(db, {
      tenantId: scope.tenantId,
      items: [
        {
          productId: result.id,
          mediaId: productMediaId,
        },
      ],
    });
    assert.deepEqual(productMediaRecords, [
      {
        productId: result.id,
        mediaId: productMediaId,
        objectKey: detail.media[0]?.objectKey,
      },
    ]);

    const unassignedManagerMediaRecords = await findTenantProductMediaRecords(
      db,
      {
        tenantId: scope.tenantId,
        allowedBranchIds: [],
        items: [
          {
            productId: result.id,
            mediaId: productMediaId,
          },
        ],
      },
    );
    assert.deepEqual(
      unassignedManagerMediaRecords,
      [],
      "product images must respect branch-scoped product access",
    );

    const updated = await updateTenantProductRecord(db, {
      tenantId: scope.tenantId,
      actorUserId: scope.actorUserId,
      updateTenantDefaultPrice: true,
      productId: result.id,
      version: detail.version,
      skuId: detail.sku.id,
      skuVersion: detail.sku.version,
      name: `${detail.name} updated`,
      categoryId: laundryCare.id,
      categoryAttributes: [
        {
          definitionId: fabricSuitability.id,
          optionIds: [fabricSuitability.options[0]!.id],
        },
        {
          definitionId: productType.id,
          optionIds: [productType.options[0]!.id],
        },
        {
          definitionId: usageInstructions.id,
          textValue: "更新后的使用说明",
        },
      ],
      tags: ["updated"],
      status: "active",
      skuCode: detail.sku.skuCode,
      barcode: undefined,
      variantName: undefined,
      unitOfMeasure: "piece",
      unitsPerSale: "1",
      salePrice: "109.00",
      currency: "CNY",
      referenceCost: "50.00",
      trackInventory: true,
      allowNegativeStock: false,
      allowOfflineSale: true,
      branchSettings: [
        {
          branchId: scope.branchId,
          expectedStockOnHand: "0",
          stockOnHand: "3",
          reorderPoint: "1",
        },
      ],
      retainedMediaIds: [],
      newMediaObjectKeys: [],
    });

    assert.equal(updated.version, detail.version + 1);
    assert.equal(updated.sku.version, detail.sku.version + 1);
    assert.equal(updated.name, `${detail.name} updated`);
    assert.equal(updated.salePrice, "109.00");
    assert.equal(updated.sku.referenceCost, "50.00");
    assert.equal(updated.branchSettings[0]?.onHandQuantity, "3.000");
    assert.equal(updated.media.length, 0);
    assert.deepEqual(updated.tags, ["updated"]);
    assert.deepEqual(
      updated.categoryAttributes.find(
        (attribute) => attribute.definitionId === usageInstructions.id,
      ),
      {
        definitionId: usageInstructions.id,
        textValue: "更新后的使用说明",
      },
    );

    const [removedMediaAssociation] = await db
      .select({ deletedAt: productMedia.deletedAt })
      .from(productMedia)
      .where(eq(productMedia.id, productMediaId));
    const [removedMediaObject] = await db
      .select({
        status: mediaObjects.status,
        cleanupClaimedAt: mediaObjects.cleanupClaimedAt,
      })
      .from(mediaObjects)
      .where(eq(mediaObjects.id, mediaObjectId));
    assert.ok(removedMediaAssociation?.deletedAt);
    assert.equal(removedMediaObject?.status, "deleting");
    assert.equal(
      removedMediaObject.cleanupClaimedAt?.getTime(),
      0,
      "removed product media must be immediately reclaimable by cleanup",
    );

    const adjustmentRows = await db
      .select({
        movementType: inventoryMovements.movementType,
        quantityDelta: inventoryMovements.quantityDelta,
      })
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.tenantId, scope.tenantId),
          eq(inventoryMovements.productSkuId, detail.sku.id),
          eq(inventoryMovements.referenceType, "product_update"),
        ),
      );
    assert.deepEqual(adjustmentRows, [
      {
        movementType: "adjustment_in",
        quantityDelta: "3.000",
      },
    ]);

    await db
      .update(inventoryBalances)
      .set({ onHandQuantity: "2.000" })
      .where(
        and(
          eq(inventoryBalances.tenantId, scope.tenantId),
          eq(inventoryBalances.branchId, scope.branchId),
          eq(inventoryBalances.productSkuId, updated.sku.id),
        ),
      );

    const preservedConcurrentStock = await updateTenantProductRecord(db, {
      tenantId: scope.tenantId,
      actorUserId: scope.actorUserId,
      updateTenantDefaultPrice: true,
      productId: result.id,
      version: updated.version,
      skuId: updated.sku.id,
      skuVersion: updated.sku.version,
      name: updated.name,
      categoryId: laundryCare.id,
      categoryAttributes: updated.categoryAttributes,
      tags: updated.tags,
      status: "active",
      skuCode: updated.sku.skuCode,
      barcode: undefined,
      variantName: undefined,
      unitOfMeasure: updated.sku.unitOfMeasure,
      unitsPerSale: updated.sku.unitsPerSale,
      salePrice: updated.salePrice,
      currency: updated.currency,
      referenceCost: updated.sku.referenceCost,
      trackInventory: true,
      allowNegativeStock: false,
      allowOfflineSale: true,
      branchSettings: [
        {
          branchId: scope.branchId,
          expectedStockOnHand: "3",
          stockOnHand: "3",
          reorderPoint: "1",
        },
      ],
      retainedMediaIds: [],
      newMediaObjectKeys: [],
    });
    assert.equal(
      preservedConcurrentStock.branchSettings[0]?.onHandQuantity,
      "2.000",
      "saving unchanged stock must preserve a concurrent sale or receipt",
    );

    await assert.rejects(
      () =>
        updateTenantProductRecord(db, {
          tenantId: scope.tenantId!,
          actorUserId: scope.actorUserId,
          updateTenantDefaultPrice: true,
          productId: result.id,
          version: preservedConcurrentStock.version,
          skuId: preservedConcurrentStock.sku.id,
          skuVersion: preservedConcurrentStock.sku.version,
          name: preservedConcurrentStock.name,
          categoryId: laundryCare.id,
          categoryAttributes: preservedConcurrentStock.categoryAttributes,
          tags: preservedConcurrentStock.tags,
          status: preservedConcurrentStock.status,
          skuCode: preservedConcurrentStock.sku.skuCode,
          barcode: undefined,
          variantName: undefined,
          unitOfMeasure: preservedConcurrentStock.sku.unitOfMeasure,
          unitsPerSale: preservedConcurrentStock.sku.unitsPerSale,
          salePrice: preservedConcurrentStock.salePrice,
          currency: preservedConcurrentStock.currency,
          referenceCost: preservedConcurrentStock.sku.referenceCost,
          trackInventory: true,
          allowNegativeStock: false,
          allowOfflineSale: true,
          branchSettings: [
            {
              branchId: scope.branchId,
              expectedStockOnHand: "3",
              stockOnHand: "5",
              reorderPoint: "1",
            },
          ],
          retainedMediaIds: [],
          newMediaObjectKeys: [],
        }),
      (error: unknown) =>
        error instanceof TenantProductsError &&
        error.code === "PRODUCT_INVENTORY_CONFLICT",
      "an edited stale stock snapshot must reject the whole update",
    );

    const afterInventoryConflict = await findTenantProductDetailRecord(db, {
      tenantId: scope.tenantId,
      productId: result.id,
      preferTenantDefaultPrice: true,
    });
    assert.ok(afterInventoryConflict);
    assert.equal(
      afterInventoryConflict.version,
      preservedConcurrentStock.version,
      "an inventory conflict must roll back the product version",
    );
    assert.equal(
      afterInventoryConflict.branchSettings[0]?.onHandQuantity,
      "2.000",
      "an inventory conflict must not change stock",
    );

    const firstNegativeStock = await updateTenantProductRecord(db, {
      tenantId: scope.tenantId,
      actorUserId: scope.actorUserId,
      updateTenantDefaultPrice: true,
      productId: result.id,
      version: afterInventoryConflict.version,
      skuId: afterInventoryConflict.sku.id,
      skuVersion: afterInventoryConflict.sku.version,
      name: afterInventoryConflict.name,
      categoryId: laundryCare.id,
      categoryAttributes: afterInventoryConflict.categoryAttributes,
      tags: afterInventoryConflict.tags,
      status: afterInventoryConflict.status,
      skuCode: afterInventoryConflict.sku.skuCode,
      barcode: undefined,
      variantName: undefined,
      unitOfMeasure: afterInventoryConflict.sku.unitOfMeasure,
      unitsPerSale: afterInventoryConflict.sku.unitsPerSale,
      salePrice: afterInventoryConflict.salePrice,
      currency: afterInventoryConflict.currency,
      referenceCost: afterInventoryConflict.sku.referenceCost,
      trackInventory: true,
      allowNegativeStock: true,
      allowOfflineSale: true,
      branchSettings: [
        {
          branchId: scope.branchId,
          expectedStockOnHand: "2",
          stockOnHand: "-0.500",
          reorderPoint: "1",
        },
      ],
      retainedMediaIds: [],
      newMediaObjectKeys: [],
    });
    assert.equal(
      firstNegativeStock.branchSettings[0]?.onHandQuantity,
      "-0.500",
    );

    const secondNegativeStock = await updateTenantProductRecord(db, {
      tenantId: scope.tenantId,
      actorUserId: scope.actorUserId,
      updateTenantDefaultPrice: true,
      productId: result.id,
      version: firstNegativeStock.version,
      skuId: firstNegativeStock.sku.id,
      skuVersion: firstNegativeStock.sku.version,
      name: firstNegativeStock.name,
      categoryId: laundryCare.id,
      categoryAttributes: firstNegativeStock.categoryAttributes,
      tags: firstNegativeStock.tags,
      status: firstNegativeStock.status,
      skuCode: firstNegativeStock.sku.skuCode,
      barcode: undefined,
      variantName: undefined,
      unitOfMeasure: firstNegativeStock.sku.unitOfMeasure,
      unitsPerSale: firstNegativeStock.sku.unitsPerSale,
      salePrice: firstNegativeStock.salePrice,
      currency: firstNegativeStock.currency,
      referenceCost: firstNegativeStock.sku.referenceCost,
      trackInventory: true,
      allowNegativeStock: true,
      allowOfflineSale: true,
      branchSettings: [
        {
          branchId: scope.branchId,
          expectedStockOnHand: "-0.500",
          stockOnHand: "-1.250",
          reorderPoint: "1",
        },
      ],
      retainedMediaIds: [],
      newMediaObjectKeys: [],
    });
    assert.equal(
      secondNegativeStock.branchSettings[0]?.onHandQuantity,
      "-1.250",
    );

    const untracked = await updateTenantProductRecord(db, {
      tenantId: scope.tenantId,
      actorUserId: scope.actorUserId,
      updateTenantDefaultPrice: true,
      productId: result.id,
      version: secondNegativeStock.version,
      skuId: secondNegativeStock.sku.id,
      skuVersion: secondNegativeStock.sku.version,
      name: secondNegativeStock.name,
      categoryId: laundryCare.id,
      categoryAttributes: secondNegativeStock.categoryAttributes,
      tags: secondNegativeStock.tags,
      status: secondNegativeStock.status,
      skuCode: secondNegativeStock.sku.skuCode,
      barcode: undefined,
      variantName: undefined,
      unitOfMeasure: secondNegativeStock.sku.unitOfMeasure,
      unitsPerSale: secondNegativeStock.sku.unitsPerSale,
      salePrice: secondNegativeStock.salePrice,
      currency: secondNegativeStock.currency,
      referenceCost: secondNegativeStock.sku.referenceCost,
      trackInventory: false,
      allowNegativeStock: false,
      allowOfflineSale: true,
      branchSettings: [
        {
          branchId: scope.branchId,
          expectedStockOnHand: "-1.250",
          stockOnHand: "0",
          reorderPoint: "0",
        },
      ],
      retainedMediaIds: [],
      newMediaObjectKeys: [],
    });
    assert.equal(
      untracked.branchSettings[0]?.onHandQuantity,
      "-1.250",
      "disabling inventory tracking must preserve the existing stock balance",
    );

    const allAdjustmentRows = await db
      .select({
        movementType: inventoryMovements.movementType,
        quantityDelta: inventoryMovements.quantityDelta,
      })
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.tenantId, scope.tenantId),
          eq(inventoryMovements.productSkuId, detail.sku.id),
          eq(inventoryMovements.referenceType, "product_update"),
        ),
      );
    assert.deepEqual(
      allAdjustmentRows
        .map((movement) => movement.quantityDelta)
        .sort((left, right) => Number(left) - Number(right)),
      ["-2.500", "-0.750", "3.000"],
      "negative stock changes must create correctly signed adjustments",
    );

    const secondBranchId = createId();
    branchIdHolder.push(secondBranchId);
    await db.insert(branches).values({
      id: secondBranchId,
      tenantId: scope.tenantId,
      name: `Product update smoke branch ${secondBranchId}`,
      defaultCurrency: "CNY",
      status: "active",
      createdBy: scope.actorUserId,
      updatedBy: scope.actorUserId,
    });
    await db
      .update(branchProductSettings)
      .set({
        allowNegativeStock: false,
        allowOfflineSale: false,
      })
      .where(
        and(
          eq(branchProductSettings.tenantId, scope.tenantId),
          eq(branchProductSettings.branchId, scope.branchId),
          eq(branchProductSettings.productSkuId, untracked.sku.id),
        ),
      );
    await db.insert(branchProductSettings).values({
      id: createId(),
      tenantId: scope.tenantId,
      branchId: secondBranchId,
      productSkuId: untracked.sku.id,
      isAvailable: true,
      allowNegativeStock: true,
      allowOfflineSale: true,
      reorderPoint: "0",
      createdBy: scope.actorUserId,
      updatedBy: scope.actorUserId,
    });
    await db.insert(inventoryBalances).values({
      id: createId(),
      tenantId: scope.tenantId,
      branchId: secondBranchId,
      productSkuId: untracked.sku.id,
      onHandQuantity: "0",
      reservedQuantity: "0",
      updatedBy: scope.actorUserId,
    });
    await db.insert(productPrices).values([
      {
        id: createId(),
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        productSkuId: untracked.sku.id,
        amount: "10",
        currency: "CNY",
        status: "active",
        createdAt: new Date("2020-01-01T00:00:00.000Z"),
        updatedAt: new Date("2020-01-01T00:00:00.000Z"),
        createdBy: scope.actorUserId,
        updatedBy: scope.actorUserId,
      },
      {
        id: createId(),
        tenantId: scope.tenantId,
        branchId: secondBranchId,
        productSkuId: untracked.sku.id,
        amount: "20",
        currency: "CNY",
        status: "active",
        createdAt: new Date("2020-01-01T00:00:00.001Z"),
        updatedAt: new Date("2020-01-01T00:00:00.001Z"),
        createdBy: scope.actorUserId,
        updatedBy: scope.actorUserId,
      },
    ]);

    const managerDetail = await findTenantProductDetailRecord(db, {
      tenantId: scope.tenantId,
      allowedBranchIds: [scope.branchId, secondBranchId],
      productId: result.id,
      preferTenantDefaultPrice: false,
    });
    assert.ok(managerDetail);
    assert.equal(managerDetail.salePrice, "10.00");

    const preservedBranchDifferences = await updateTenantProductRecord(db, {
      tenantId: scope.tenantId,
      allowedBranchIds: [scope.branchId, secondBranchId],
      actorUserId: scope.actorUserId,
      updateTenantDefaultPrice: false,
      productId: result.id,
      version: managerDetail.version,
      skuId: managerDetail.sku.id,
      skuVersion: managerDetail.sku.version,
      name: managerDetail.name,
      categoryId: laundryCare.id,
      categoryAttributes: managerDetail.categoryAttributes,
      tags: managerDetail.tags,
      status: managerDetail.status,
      skuCode: managerDetail.sku.skuCode,
      barcode: undefined,
      variantName: undefined,
      unitOfMeasure: managerDetail.sku.unitOfMeasure,
      unitsPerSale: managerDetail.sku.unitsPerSale,
      salePrice: managerDetail.salePrice,
      currency: managerDetail.currency,
      referenceCost: managerDetail.sku.referenceCost,
      trackInventory: false,
      allowNegativeStock: false,
      allowOfflineSale: false,
      branchSettings: [
        {
          branchId: scope.branchId,
          expectedStockOnHand: "-1.250",
          stockOnHand: "0",
          reorderPoint: "0",
        },
        {
          branchId: secondBranchId,
          expectedStockOnHand: "0",
          stockOnHand: "0",
          reorderPoint: "0",
        },
      ],
      retainedMediaIds: [],
      newMediaObjectKeys: [],
    });

    const preservedPriceRows = await db
      .select({
        branchId: productPrices.branchId,
        amount: productPrices.amount,
      })
      .from(productPrices)
      .where(
        and(
          eq(productPrices.tenantId, scope.tenantId),
          eq(productPrices.productSkuId, untracked.sku.id),
          inArray(productPrices.branchId, [scope.branchId, secondBranchId]),
          isNull(productPrices.deletedAt),
        ),
      );
    assert.deepEqual(
      new Map(
        preservedPriceRows.map((price) => [price.branchId, price.amount]),
      ),
      new Map([
        [scope.branchId, "10.00"],
        [secondBranchId, "20.00"],
      ]),
      "an unrelated edit must preserve branch-specific prices",
    );

    const preservedPolicyRows = await db
      .select({
        branchId: branchProductSettings.branchId,
        allowNegativeStock: branchProductSettings.allowNegativeStock,
        allowOfflineSale: branchProductSettings.allowOfflineSale,
      })
      .from(branchProductSettings)
      .where(
        and(
          eq(branchProductSettings.tenantId, scope.tenantId),
          eq(branchProductSettings.productSkuId, untracked.sku.id),
          inArray(branchProductSettings.branchId, [
            scope.branchId,
            secondBranchId,
          ]),
        ),
      );
    const preservedPolicyByBranchId = new Map(
      preservedPolicyRows.map((setting) => [setting.branchId, setting]),
    );
    assert.equal(
      preservedPolicyByBranchId.get(scope.branchId)?.allowNegativeStock,
      false,
    );
    assert.equal(
      preservedPolicyByBranchId.get(secondBranchId)?.allowNegativeStock,
      true,
    );
    assert.equal(
      preservedPolicyByBranchId.get(scope.branchId)?.allowOfflineSale,
      false,
    );
    assert.equal(
      preservedPolicyByBranchId.get(secondBranchId)?.allowOfflineSale,
      true,
    );

    const changedOfflinePolicies = await updateTenantProductRecord(db, {
      tenantId: scope.tenantId,
      allowedBranchIds: [scope.branchId, secondBranchId],
      actorUserId: scope.actorUserId,
      updateTenantDefaultPrice: false,
      productId: result.id,
      version: preservedBranchDifferences.version,
      skuId: preservedBranchDifferences.sku.id,
      skuVersion: preservedBranchDifferences.sku.version,
      name: preservedBranchDifferences.name,
      categoryId: laundryCare.id,
      categoryAttributes: preservedBranchDifferences.categoryAttributes,
      tags: preservedBranchDifferences.tags,
      status: preservedBranchDifferences.status,
      skuCode: preservedBranchDifferences.sku.skuCode,
      barcode: undefined,
      variantName: undefined,
      unitOfMeasure: preservedBranchDifferences.sku.unitOfMeasure,
      unitsPerSale: preservedBranchDifferences.sku.unitsPerSale,
      salePrice: preservedBranchDifferences.salePrice,
      currency: preservedBranchDifferences.currency,
      referenceCost: preservedBranchDifferences.sku.referenceCost,
      trackInventory: false,
      allowNegativeStock: false,
      allowOfflineSale: true,
      branchSettings: [
        {
          branchId: scope.branchId,
          expectedStockOnHand: "-1.250",
          stockOnHand: "0",
          reorderPoint: "0",
        },
        {
          branchId: secondBranchId,
          expectedStockOnHand: "0",
          stockOnHand: "0",
          reorderPoint: "0",
        },
      ],
      retainedMediaIds: [],
      newMediaObjectKeys: [],
    });
    const changedOfflinePolicyRows = await db
      .select({
        branchId: branchProductSettings.branchId,
        allowNegativeStock: branchProductSettings.allowNegativeStock,
        allowOfflineSale: branchProductSettings.allowOfflineSale,
      })
      .from(branchProductSettings)
      .where(
        and(
          eq(branchProductSettings.tenantId, scope.tenantId),
          eq(branchProductSettings.productSkuId, untracked.sku.id),
          inArray(branchProductSettings.branchId, [
            scope.branchId,
            secondBranchId,
          ]),
        ),
      );
    const changedOfflinePolicyByBranchId = new Map(
      changedOfflinePolicyRows.map((setting) => [setting.branchId, setting]),
    );
    assert.equal(
      changedOfflinePolicyByBranchId.get(scope.branchId)?.allowOfflineSale,
      true,
    );
    assert.equal(
      changedOfflinePolicyByBranchId.get(secondBranchId)?.allowOfflineSale,
      true,
    );
    assert.equal(
      changedOfflinePolicyByBranchId.get(scope.branchId)?.allowNegativeStock,
      false,
    );
    assert.equal(
      changedOfflinePolicyByBranchId.get(secondBranchId)?.allowNegativeStock,
      true,
      "changing offline sale must not flatten negative-stock policies",
    );

    await db.insert(productPrices).values([
      {
        id: createId(),
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        productSkuId: untracked.sku.id,
        amount: "12",
        currency: "USD",
        status: "active",
        createdAt: new Date("2021-01-01T00:00:00.000Z"),
        updatedAt: new Date("2021-01-01T00:00:00.000Z"),
        createdBy: scope.actorUserId,
        updatedBy: scope.actorUserId,
      },
      {
        id: createId(),
        tenantId: scope.tenantId,
        branchId: secondBranchId,
        productSkuId: untracked.sku.id,
        amount: "22",
        currency: "USD",
        status: "active",
        createdAt: new Date("2021-01-01T00:00:00.001Z"),
        updatedAt: new Date("2021-01-01T00:00:00.001Z"),
        createdBy: scope.actorUserId,
        updatedBy: scope.actorUserId,
      },
    ]);
    const changedCurrency = await updateTenantProductRecord(db, {
      tenantId: scope.tenantId,
      allowedBranchIds: [scope.branchId, secondBranchId],
      actorUserId: scope.actorUserId,
      updateTenantDefaultPrice: false,
      productId: result.id,
      version: changedOfflinePolicies.version,
      skuId: changedOfflinePolicies.sku.id,
      skuVersion: changedOfflinePolicies.sku.version,
      name: changedOfflinePolicies.name,
      categoryId: laundryCare.id,
      categoryAttributes: changedOfflinePolicies.categoryAttributes,
      tags: changedOfflinePolicies.tags,
      status: changedOfflinePolicies.status,
      skuCode: changedOfflinePolicies.sku.skuCode,
      barcode: undefined,
      variantName: undefined,
      unitOfMeasure: changedOfflinePolicies.sku.unitOfMeasure,
      unitsPerSale: changedOfflinePolicies.sku.unitsPerSale,
      salePrice: "30",
      currency: "EUR",
      referenceCost: changedOfflinePolicies.sku.referenceCost,
      trackInventory: false,
      allowNegativeStock: false,
      allowOfflineSale: true,
      branchSettings: [
        {
          branchId: scope.branchId,
          expectedStockOnHand: "-1.250",
          stockOnHand: "0",
          reorderPoint: "0",
        },
        {
          branchId: secondBranchId,
          expectedStockOnHand: "0",
          stockOnHand: "0",
          reorderPoint: "0",
        },
      ],
      retainedMediaIds: [],
      newMediaObjectKeys: [],
    });
    assert.equal(changedCurrency.currency, "EUR");
    assert.equal(
      changedCurrency.sku.referenceCostCurrency,
      "CNY",
      "changing sale currency must not rewrite an unchanged cost currency",
    );
    const changedCurrencyPriceRows = await db
      .select({
        branchId: productPrices.branchId,
        currency: productPrices.currency,
      })
      .from(productPrices)
      .where(
        and(
          eq(productPrices.tenantId, scope.tenantId),
          eq(productPrices.productSkuId, untracked.sku.id),
          inArray(productPrices.branchId, [scope.branchId, secondBranchId]),
          isNull(productPrices.deletedAt),
        ),
      );
    assert.equal(changedCurrencyPriceRows.length, 2);
    assert.ok(
      changedCurrencyPriceRows.every((price) => price.currency === "EUR"),
      "an explicit currency change must leave one stable display currency per branch",
    );

    await assert.rejects(
      () =>
        updateTenantProductRecord(db, {
          tenantId: scope.tenantId!,
          actorUserId: scope.actorUserId,
          updateTenantDefaultPrice: true,
          productId: result.id,
          version: detail.version,
          skuId: detail.sku.id,
          skuVersion: detail.sku.version,
          name: detail.name,
          categoryId: laundryCare.id,
          categoryAttributes: detail.categoryAttributes,
          tags: detail.tags,
          status: "active",
          skuCode: detail.sku.skuCode,
          unitOfMeasure: detail.sku.unitOfMeasure,
          unitsPerSale: detail.sku.unitsPerSale,
          salePrice: detail.salePrice,
          currency: detail.currency,
          referenceCost: detail.sku.referenceCost,
          trackInventory: detail.sku.trackInventory,
          allowNegativeStock: false,
          allowOfflineSale: false,
          branchSettings: [
            {
              branchId: scope.branchId,
              expectedStockOnHand: "3",
              stockOnHand: "0",
              reorderPoint: "0",
            },
          ],
          retainedMediaIds: [],
          newMediaObjectKeys: [],
        }),
      (error: unknown) =>
        error instanceof TenantProductsError &&
        error.code === "PRODUCT_VERSION_CONFLICT",
      "stale aggregate versions must be rejected",
    );

    const updateAuditRows = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, scope.tenantId),
          eq(auditLogs.entityId, result.id),
          eq(auditLogs.eventType, "product.updated"),
        ),
      );
    assert.equal(updateAuditRows.length, 8);

    const auditRows = await db
      .select({ after: auditLogs.after })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, scope.tenantId),
          eq(auditLogs.entityId, result.id),
          eq(auditLogs.eventType, "product.created"),
        ),
      )
      .limit(1);
    const auditAttributes = auditRows[0]?.after?.categoryAttributes;

    assert.ok(Array.isArray(auditAttributes));
    assert.equal(auditAttributes.length, 3);
    assert.equal(
      (
        auditAttributes.find(
          (attribute) =>
            typeof attribute === "object" &&
            attribute !== null &&
            "code" in attribute &&
            attribute.code === "usage_instructions",
        ) as { textValue?: unknown } | undefined
      )?.textValue,
      "按包装说明添加适量产品",
    );

    await assert.rejects(
      () =>
        createTenantProductRecord(db, {
          tenantId: scope.tenantId!,
          actorUserId: scope.actorUserId,
          createTenantDefaultPrice: true,
          name: "Invalid category attribute smoke",
          categoryId: laundryCare.id,
          categoryAttributes: [
            {
              definitionId: productType.id,
              optionIds: [
                productType.options[0]!.id,
                productType.options[1]?.id ?? productType.options[0]!.id,
              ],
            },
          ],
          tags: [],
          status: "active",
          skuCode: `ATTR-INVALID-${createId()}`,
          unitOfMeasure: "piece",
          unitsPerSale: "1",
          salePrice: "1.00",
          currency: "CNY",
          referenceCost: null,
          trackInventory: true,
          allowNegativeStock: false,
          allowOfflineSale: false,
          branchSettings: [
            {
              branchId: scope.branchId,
              openingStock: "0",
              reorderPoint: "0",
            },
          ],
          mediaObjectKeys: [],
        }),
      (error: unknown) =>
        error instanceof TenantProductsError &&
        error.code === "PRODUCT_CATEGORY_ATTRIBUTE_INVALID",
      "single-select attributes must reject multiple options",
    );
  } finally {
    if (productIdHolder.length > 0) {
      const skuRows = await db
        .select({ id: productSkus.id })
        .from(productSkus)
        .where(inArray(productSkus.productId, productIdHolder));
      const skuIds = skuRows.map((sku) => sku.id);
      const valueRows = await db
        .select({ id: productAttributeValues.id })
        .from(productAttributeValues)
        .where(inArray(productAttributeValues.productId, productIdHolder));
      const valueIds = valueRows.map((value) => value.id);

      await db
        .delete(auditLogs)
        .where(inArray(auditLogs.entityId, productIdHolder));
      if (valueIds.length > 0) {
        await db
          .delete(productAttributeValueOptions)
          .where(
            inArray(productAttributeValueOptions.attributeValueId, valueIds),
          );
      }
      await db
        .delete(productAttributeValues)
        .where(inArray(productAttributeValues.productId, productIdHolder));
      await db
        .delete(productMedia)
        .where(inArray(productMedia.productId, productIdHolder));

      if (skuIds.length > 0) {
        await db
          .delete(inventoryMovements)
          .where(inArray(inventoryMovements.productSkuId, skuIds));
        await db
          .delete(inventoryBalances)
          .where(inArray(inventoryBalances.productSkuId, skuIds));
        await db
          .delete(branchProductSettings)
          .where(inArray(branchProductSettings.productSkuId, skuIds));
        await db
          .delete(productPrices)
          .where(inArray(productPrices.productSkuId, skuIds));
        await db.delete(productSkus).where(inArray(productSkus.id, skuIds));
      }

      await db.delete(products).where(inArray(products.id, productIdHolder));
      if (mediaObjectIdHolder.length > 0) {
        await db
          .delete(mediaObjects)
          .where(inArray(mediaObjects.id, mediaObjectIdHolder));
      }
      if (branchIdHolder.length > 0) {
        await db.delete(branches).where(inArray(branches.id, branchIdHolder));
      }
    }
  }

  const laundryCareRows = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.tenantId, scope.tenantId),
        eq(productCategories.code, "laundry_care"),
        isNull(productCategories.deletedAt),
      ),
    );
  const laundryCareDefinitionRows = await db
    .select({ id: productCategoryAttributeDefinitions.id })
    .from(productCategoryAttributeDefinitions)
    .where(
      and(
        eq(productCategoryAttributeDefinitions.tenantId, scope.tenantId),
        inArray(
          productCategoryAttributeDefinitions.categoryId,
          laundryCareRows.map((category) => category.id),
        ),
        isNull(productCategoryAttributeDefinitions.deletedAt),
      ),
    );

  assert.equal(laundryCareRows.length, 1);
  assert.ok(laundryCareDefinitionRows.length >= 7);
}

if (
  process.argv[1]?.endsWith("products.category-attributes.repository.smoke.ts")
) {
  try {
    await runTenantProductCategoryAttributeRepositorySmokeChecks();
  } finally {
    await closeDbConnection();
  }
}
