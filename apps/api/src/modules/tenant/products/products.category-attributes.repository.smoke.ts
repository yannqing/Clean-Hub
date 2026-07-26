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
  productAttributeValueOptions,
  productAttributeValues,
  productCategories,
  productCategoryAttributeDefinitions,
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
  findTenantProductCategories,
  findTenantProductCategoryAttributes,
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

      if (skuIds.length > 0) {
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
