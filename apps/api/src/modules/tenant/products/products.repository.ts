import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  branchProductSettings,
  branches,
  inventoryBalances,
  inventoryMovements,
  mediaObjects,
  productAttributeValueOptions,
  productAttributeValues,
  productCategories,
  productCategoryAttributeDefinitions,
  productCategoryAttributeOptions,
  productMedia,
  productPrices,
  products,
  productSkus,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type { AuthRequestMeta } from "../../auth/auth.types.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { DEFAULT_PRODUCT_CATEGORIES } from "./products.category-defaults.js";
import { TenantProductsError } from "./products.errors.js";
import type {
  CreateTenantProductCategoryAttribute,
  CreateTenantProductRequest,
  CreateTenantProductResponse,
  TenantProductCategoryAttributeDefinition,
  TenantProductCategoryAttributeListResponse,
  TenantProductDetailRecord,
  TenantProductListQuery,
  TenantProductListResponse,
  TenantProductCategoryListResponse,
  TenantProductOverview,
  TenantProductOverviewQuery,
  TenantProductPriceRange,
  TenantProductRepositoryScope,
  TenantProductSummary,
  UpdateTenantProductRequest,
} from "./products.types.js";

type ProductFilterInput = {
  tenantId: string;
  allowedBranchIds?: string[];
  q?: string;
  status?: TenantProductListQuery["status"];
  createdAfter?: string;
  createdBefore?: string;
};

type ProductSkuRow = {
  id: string;
  productId: string;
  skuCode: string;
  barcode: string | null;
  status: "active" | "inactive";
  trackInventory: boolean;
  createdAt: Date;
};

type ProductPriceRow = {
  productSkuId: string;
  branchId: string | null;
  amount: string;
  currency: string;
};

type CreateTenantProductRecordInput = CreateTenantProductRequest & {
  tenantId: string;
  actorUserId: string;
  /**
   * Owners create a tenant-wide default price. Managers create branch
   * overrides for the selected branch settings only, so their write cannot
   * affect branches outside their authorized scope.
   */
  createTenantDefaultPrice: boolean;
  requestMeta?: AuthRequestMeta;
};

type UpdateTenantProductRecordInput = UpdateTenantProductRequest &
  TenantProductRepositoryScope & {
    productId: string;
    actorUserId: string;
    updateTenantDefaultPrice: boolean;
    requestMeta?: AuthRequestMeta;
  };

function normalizeNullable(value: string | undefined): string | null {
  return value ?? null;
}

function buildSqlValueList(values: string[]): SQL {
  return sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );
}

function buildProductBranchScopeFilter(
  allowedBranchIds: string[] | undefined,
): SQL | null {
  if (allowedBranchIds === undefined) {
    return null;
  }

  if (allowedBranchIds.length === 0) {
    return sql`false`;
  }

  return sql`exists (
    select 1
    from "product_skus" as "scoped_product_skus"
    inner join "branch_product_settings" as "scoped_branch_product_settings"
      on "scoped_branch_product_settings"."tenant_id" = "scoped_product_skus"."tenant_id"
      and "scoped_branch_product_settings"."product_sku_id" = "scoped_product_skus"."id"
    where "scoped_product_skus"."tenant_id" = ${products.tenantId}
      and "scoped_product_skus"."product_id" = ${products.id}
      and "scoped_product_skus"."deleted_at" is null
      and "scoped_branch_product_settings"."is_available" = true
      and "scoped_branch_product_settings"."branch_id" in (
        ${buildSqlValueList(allowedBranchIds)}
      )
  )`;
}

function buildSkuBranchScopeFilter(
  allowedBranchIds: string[] | undefined,
): SQL | null {
  if (allowedBranchIds === undefined) {
    return null;
  }

  if (allowedBranchIds.length === 0) {
    return sql`false`;
  }

  return sql`exists (
    select 1
    from "branch_product_settings" as "scoped_sku_branch_settings"
    where "scoped_sku_branch_settings"."tenant_id" = ${productSkus.tenantId}
      and "scoped_sku_branch_settings"."product_sku_id" = ${productSkus.id}
      and "scoped_sku_branch_settings"."is_available" = true
      and "scoped_sku_branch_settings"."branch_id" in (
        ${buildSqlValueList(allowedBranchIds)}
      )
  )`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function findDatabaseConstraint(
  error: unknown,
  seen = new Set<unknown>(),
): string | null {
  if (!isRecord(error) || seen.has(error)) {
    return null;
  }

  seen.add(error);

  if (error.code === "23505" && typeof error.constraint === "string") {
    return error.constraint;
  }

  return findDatabaseConstraint(error.cause, seen);
}

function mapProductCreateConstraint(
  error: unknown,
): TenantProductsError | null {
  const constraint = findDatabaseConstraint(error)?.toLowerCase();

  if (constraint?.includes("product_skus_tenant_sku_code_unique")) {
    return new TenantProductsError(
      "PRODUCT_SKU_CODE_DUPLICATE",
      "SKU code already exists in this tenant.",
      409,
    );
  }

  if (constraint?.includes("product_skus_tenant_barcode_unique")) {
    return new TenantProductsError(
      "PRODUCT_BARCODE_DUPLICATE",
      "Barcode already exists in this tenant.",
      409,
    );
  }

  return null;
}

async function requireProductBranches(
  db: Database,
  input: { tenantId: string; branchIds: string[] },
): Promise<void> {
  const rows = await db
    .select({ id: branches.id })
    .from(branches)
    .where(
      and(
        eq(branches.tenantId, input.tenantId),
        inArray(branches.id, input.branchIds),
        eq(branches.status, "active"),
        isNull(branches.deletedAt),
      ),
    );

  if (rows.length !== input.branchIds.length) {
    throw new TenantProductsError(
      "PRODUCT_BRANCH_NOT_FOUND",
      "One or more selected branches were not found or are inactive.",
      404,
    );
  }
}

type LockedProductMediaObject = {
  id: string;
  objectKey: string;
};

async function lockPendingProductMediaObjects(
  db: Database,
  input: {
    tenantId: string;
    actorUserId: string;
    objectKeys: string[];
  },
): Promise<LockedProductMediaObject[]> {
  if (input.objectKeys.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: mediaObjects.id,
      objectKey: mediaObjects.objectKey,
      status: mediaObjects.status,
      purpose: mediaObjects.purpose,
      createdBy: mediaObjects.createdBy,
      expiresAt: mediaObjects.expiresAt,
    })
    .from(mediaObjects)
    .where(
      and(
        eq(mediaObjects.tenantId, input.tenantId),
        inArray(mediaObjects.objectKey, input.objectKeys),
        isNull(mediaObjects.deletedAt),
      ),
    )
    .orderBy(asc(mediaObjects.objectKey))
    .for("update");

  const rowsByKey = new Map(rows.map((row) => [row.objectKey, row]));

  for (const objectKey of input.objectKeys) {
    const row = rowsByKey.get(objectKey);

    if (!row) {
      throw new TenantProductsError(
        "PRODUCT_MEDIA_NOT_FOUND",
        "One or more product images were not found.",
        404,
      );
    }

    if (row.createdBy !== input.actorUserId) {
      throw new TenantProductsError(
        "PRODUCT_MEDIA_FORBIDDEN",
        "One or more product images are not accessible.",
        403,
      );
    }

    if (row.purpose !== "product_image") {
      throw new TenantProductsError(
        "PRODUCT_MEDIA_INVALID",
        "One or more media objects are not product images.",
        422,
      );
    }

    if (row.status === "deleting") {
      throw new TenantProductsError(
        "PRODUCT_MEDIA_CONFLICT",
        "One or more product images are being deleted.",
        409,
      );
    }

    if (row.status !== "pending") {
      throw new TenantProductsError(
        "PRODUCT_MEDIA_CONFLICT",
        "One or more product images have already been used.",
        409,
      );
    }

    if (row.expiresAt.getTime() < Date.now()) {
      throw new TenantProductsError(
        "PRODUCT_MEDIA_INVALID",
        "One or more product image upload tickets have expired.",
        422,
      );
    }
  }

  const orderedRows = input.objectKeys.map(
    (objectKey) => rowsByKey.get(objectKey)!,
  );
  const boundRows = await db
    .select({ id: productMedia.id })
    .from(productMedia)
    .where(
      and(
        eq(productMedia.tenantId, input.tenantId),
        inArray(
          productMedia.mediaObjectId,
          orderedRows.map((row) => row.id),
        ),
        isNull(productMedia.deletedAt),
      ),
    )
    .limit(1);

  if (boundRows[0]) {
    throw new TenantProductsError(
      "PRODUCT_MEDIA_CONFLICT",
      "One or more product images have already been used.",
      409,
    );
  }

  return orderedRows.map((row) => ({
    id: row.id,
    objectKey: row.objectKey,
  }));
}

async function requireUniqueSkuIdentifiers(
  db: Database,
  input: {
    tenantId: string;
    skuCode: string;
    barcode?: string;
    excludeSkuId?: string;
  },
): Promise<void> {
  const skuRows = await db
    .select({ id: productSkus.id })
    .from(productSkus)
    .where(
      and(
        eq(productSkus.tenantId, input.tenantId),
        eq(productSkus.skuCode, input.skuCode),
        isNull(productSkus.deletedAt),
      ),
    )
    .limit(1);

  if (skuRows[0] && skuRows[0].id !== input.excludeSkuId) {
    throw new TenantProductsError(
      "PRODUCT_SKU_CODE_DUPLICATE",
      "SKU code already exists in this tenant.",
      409,
    );
  }

  if (!input.barcode) {
    return;
  }

  const barcodeRows = await db
    .select({ id: productSkus.id })
    .from(productSkus)
    .where(
      and(
        eq(productSkus.tenantId, input.tenantId),
        eq(productSkus.barcode, input.barcode),
        isNull(productSkus.deletedAt),
      ),
    )
    .limit(1);

  if (barcodeRows[0] && barcodeRows[0].id !== input.excludeSkuId) {
    throw new TenantProductsError(
      "PRODUCT_BARCODE_DUPLICATE",
      "Barcode already exists in this tenant.",
      409,
    );
  }
}

export async function bootstrapDefaultProductCategoryMetadata(
  db: Database,
  input: {
    tenantId: string;
    actorUserId: string;
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    const categoryCodes = DEFAULT_PRODUCT_CATEGORIES.map(
      (category) => category.code,
    );
    let categoryRows = await tx
      .select({
        id: productCategories.id,
        code: productCategories.code,
      })
      .from(productCategories)
      .where(
        and(
          eq(productCategories.tenantId, input.tenantId),
          inArray(productCategories.code, categoryCodes),
          isNull(productCategories.deletedAt),
        ),
      );
    const existingCategoryCodes = new Set(
      categoryRows.flatMap((category) =>
        category.code ? [category.code] : [],
      ),
    );
    const missingCategories = DEFAULT_PRODUCT_CATEGORIES.filter(
      (category) => !existingCategoryCodes.has(category.code),
    );

    if (missingCategories.length > 0) {
      await tx
        .insert(productCategories)
        .values(
          missingCategories.map((category) => ({
            id: createId(),
            tenantId: input.tenantId,
            name: category.name,
            code: category.code,
            sortOrder: category.sortOrder,
            status: "active" as const,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId,
          })),
        )
        .onConflictDoNothing();

      categoryRows = await tx
        .select({
          id: productCategories.id,
          code: productCategories.code,
        })
        .from(productCategories)
        .where(
          and(
            eq(productCategories.tenantId, input.tenantId),
            inArray(productCategories.code, categoryCodes),
            isNull(productCategories.deletedAt),
          ),
        );
    }

    const categoryIdsByCode = new Map(
      categoryRows.flatMap((category) =>
        category.code ? [[category.code, category.id] as const] : [],
      ),
    );
    const desiredDefinitions = DEFAULT_PRODUCT_CATEGORIES.flatMap(
      (category) => {
        const categoryId = categoryIdsByCode.get(category.code);

        return categoryId
          ? category.attributes.map((attribute) => ({
              categoryId,
              attribute,
            }))
          : [];
      },
    );
    const categoryIds = [
      ...new Set(categoryRows.map((category) => category.id)),
    ];
    let definitionRows =
      categoryIds.length === 0
        ? []
        : await tx
            .select({
              id: productCategoryAttributeDefinitions.id,
              categoryId: productCategoryAttributeDefinitions.categoryId,
              code: productCategoryAttributeDefinitions.code,
              valueType: productCategoryAttributeDefinitions.valueType,
            })
            .from(productCategoryAttributeDefinitions)
            .where(
              and(
                eq(
                  productCategoryAttributeDefinitions.tenantId,
                  input.tenantId,
                ),
                inArray(
                  productCategoryAttributeDefinitions.categoryId,
                  categoryIds,
                ),
                isNull(productCategoryAttributeDefinitions.deletedAt),
              ),
            );
    const definitionKey = (categoryId: string, code: string) =>
      `${categoryId}:${code}`;
    const existingDefinitionKeys = new Set(
      definitionRows.map((definition) =>
        definitionKey(definition.categoryId, definition.code),
      ),
    );
    const missingDefinitions = desiredDefinitions.filter(
      ({ categoryId, attribute }) =>
        !existingDefinitionKeys.has(definitionKey(categoryId, attribute.code)),
    );

    if (missingDefinitions.length > 0) {
      await tx
        .insert(productCategoryAttributeDefinitions)
        .values(
          missingDefinitions.map(({ categoryId, attribute }) => ({
            id: createId(),
            tenantId: input.tenantId,
            categoryId,
            code: attribute.code,
            name: attribute.name,
            valueType: attribute.valueType,
            required: attribute.required,
            sortOrder: attribute.sortOrder,
            status: "active" as const,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId,
          })),
        )
        .onConflictDoNothing();

      definitionRows = await tx
        .select({
          id: productCategoryAttributeDefinitions.id,
          categoryId: productCategoryAttributeDefinitions.categoryId,
          code: productCategoryAttributeDefinitions.code,
          valueType: productCategoryAttributeDefinitions.valueType,
        })
        .from(productCategoryAttributeDefinitions)
        .where(
          and(
            eq(productCategoryAttributeDefinitions.tenantId, input.tenantId),
            inArray(
              productCategoryAttributeDefinitions.categoryId,
              categoryIds,
            ),
            isNull(productCategoryAttributeDefinitions.deletedAt),
          ),
        );
    }

    const definitionsByKey = new Map(
      definitionRows.map((definition) => [
        definitionKey(definition.categoryId, definition.code),
        definition,
      ]),
    );
    const desiredOptions = desiredDefinitions.flatMap(
      ({ categoryId, attribute }) => {
        const definition = definitionsByKey.get(
          definitionKey(categoryId, attribute.code),
        );

        if (
          !definition ||
          definition.valueType !== attribute.valueType ||
          attribute.options.length === 0
        ) {
          return [];
        }

        return attribute.options.map((option) => ({
          definitionId: definition.id,
          option,
        }));
      },
    );
    const definitionIds = [
      ...new Set(desiredOptions.map((option) => option.definitionId)),
    ];
    const existingOptionRows =
      definitionIds.length === 0
        ? []
        : await tx
            .select({
              definitionId: productCategoryAttributeOptions.definitionId,
              code: productCategoryAttributeOptions.code,
            })
            .from(productCategoryAttributeOptions)
            .where(
              and(
                eq(productCategoryAttributeOptions.tenantId, input.tenantId),
                inArray(
                  productCategoryAttributeOptions.definitionId,
                  definitionIds,
                ),
                isNull(productCategoryAttributeOptions.deletedAt),
              ),
            );
    const optionKey = (definitionId: string, code: string) =>
      `${definitionId}:${code}`;
    const existingOptionKeys = new Set(
      existingOptionRows.map((option) =>
        optionKey(option.definitionId, option.code),
      ),
    );
    const missingOptions = desiredOptions.filter(
      ({ definitionId, option }) =>
        !existingOptionKeys.has(optionKey(definitionId, option.code)),
    );

    if (missingOptions.length > 0) {
      await tx
        .insert(productCategoryAttributeOptions)
        .values(
          missingOptions.map(({ definitionId, option }) => ({
            id: createId(),
            tenantId: input.tenantId,
            definitionId,
            code: option.code,
            label: option.label,
            sortOrder: option.sortOrder,
            status: "active" as const,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId,
          })),
        )
        .onConflictDoNothing();
    }
  });
}

type ResolvedProductCategory = {
  id: string | null;
  name: string | null;
  code: string | null;
  reactivated: boolean;
};

async function resolveProductCategory(
  db: Database,
  input: {
    tenantId: string;
    categoryId?: string;
    categoryName?: string;
    actorUserId: string;
  },
): Promise<ResolvedProductCategory> {
  if (input.categoryId) {
    const categoryRows = await db
      .select({
        id: productCategories.id,
        name: productCategories.name,
        code: productCategories.code,
        status: productCategories.status,
      })
      .from(productCategories)
      .where(
        and(
          eq(productCategories.tenantId, input.tenantId),
          eq(productCategories.id, input.categoryId),
          isNull(productCategories.deletedAt),
        ),
      )
      .limit(1)
      .for("share");
    const category = categoryRows[0];

    if (!category) {
      throw new TenantProductsError(
        "PRODUCT_CATEGORY_NOT_FOUND",
        "Product category was not found.",
        404,
      );
    }

    if (category.status !== "active") {
      throw new TenantProductsError(
        "PRODUCT_CATEGORY_INACTIVE",
        "Product category is inactive.",
        422,
      );
    }

    return {
      id: category.id,
      name: category.name,
      code: category.code,
      reactivated: false,
    };
  }

  if (!input.categoryName) {
    return {
      id: null,
      name: null,
      code: null,
      reactivated: false,
    };
  }

  await db.execute(
    sql`select pg_advisory_xact_lock(
      hashtextextended(
        ${`product_category:${input.tenantId}:${input.categoryName.toLowerCase()}`},
        0
      )
    )`,
  );

  const categoryRows = await db
    .select({
      id: productCategories.id,
      name: productCategories.name,
      code: productCategories.code,
      status: productCategories.status,
    })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.tenantId, input.tenantId),
        sql`lower(${productCategories.name}) = lower(${input.categoryName})`,
        isNull(productCategories.deletedAt),
      ),
    )
    .limit(1);

  if (categoryRows[0]) {
    const category = categoryRows[0];

    if (category.status === "inactive") {
      const reactivatedRows = await db
        .update(productCategories)
        .set({
          status: "active",
          updatedAt: new Date(),
          updatedBy: input.actorUserId,
          version: sql`${productCategories.version} + 1`,
        })
        .where(
          and(
            eq(productCategories.tenantId, input.tenantId),
            eq(productCategories.id, category.id),
            eq(productCategories.status, "inactive"),
            isNull(productCategories.deletedAt),
          ),
        )
        .returning({ id: productCategories.id });

      return {
        id: category.id,
        name: category.name,
        code: category.code,
        reactivated: Boolean(reactivatedRows[0]),
      };
    }

    return {
      id: category.id,
      name: category.name,
      code: category.code,
      reactivated: false,
    };
  }

  const categoryId = createId();

  await db.insert(productCategories).values({
    id: categoryId,
    tenantId: input.tenantId,
    name: input.categoryName,
    status: "active",
    createdBy: input.actorUserId,
    updatedBy: input.actorUserId,
  });

  return {
    id: categoryId,
    name: input.categoryName,
    code: null,
    reactivated: false,
  };
}

type ResolvedProductCategoryAttributeOption = {
  id: string;
  code: string;
  label: string;
};

type ResolvedProductCategoryAttribute = {
  definitionId: string;
  definitionCode: string;
  definitionName: string;
  valueType: "text" | "single_select" | "multi_select";
  textValue: string | null;
  options: ResolvedProductCategoryAttributeOption[];
};

async function resolveProductCategoryAttributes(
  db: Database,
  input: {
    tenantId: string;
    categoryId: string | null;
    attributes: CreateTenantProductCategoryAttribute[];
  },
): Promise<ResolvedProductCategoryAttribute[]> {
  if (!input.categoryId) {
    if (input.attributes.length > 0) {
      throw new TenantProductsError(
        "PRODUCT_CATEGORY_ATTRIBUTE_INVALID",
        "Category attributes require an existing product category.",
        422,
      );
    }

    return [];
  }

  if (
    new Set(input.attributes.map((attribute) => attribute.definitionId))
      .size !== input.attributes.length
  ) {
    throw new TenantProductsError(
      "PRODUCT_CATEGORY_ATTRIBUTE_INVALID",
      "Category attribute definitions must be unique.",
      422,
    );
  }

  const definitionRows = await db
    .select({
      id: productCategoryAttributeDefinitions.id,
      code: productCategoryAttributeDefinitions.code,
      name: productCategoryAttributeDefinitions.name,
      valueType: productCategoryAttributeDefinitions.valueType,
      required: productCategoryAttributeDefinitions.required,
    })
    .from(productCategoryAttributeDefinitions)
    .where(
      and(
        eq(productCategoryAttributeDefinitions.tenantId, input.tenantId),
        eq(productCategoryAttributeDefinitions.categoryId, input.categoryId),
        eq(productCategoryAttributeDefinitions.status, "active"),
        isNull(productCategoryAttributeDefinitions.deletedAt),
      ),
    )
    .for("share");
  const definitionsById = new Map(
    definitionRows.map((definition) => [definition.id, definition]),
  );
  const attributesByDefinitionId = new Map(
    input.attributes.map((attribute) => [attribute.definitionId, attribute]),
  );
  const missingRequiredDefinition = definitionRows.find(
    (definition) =>
      definition.required && !attributesByDefinitionId.has(definition.id),
  );

  if (missingRequiredDefinition) {
    throw new TenantProductsError(
      "PRODUCT_CATEGORY_ATTRIBUTE_REQUIRED",
      `Category attribute "${missingRequiredDefinition.name}" is required.`,
      422,
    );
  }

  const requestedOptionIds = input.attributes.flatMap((attribute) =>
    Array.isArray(attribute.optionIds) ? attribute.optionIds : [],
  );
  const optionRows =
    requestedOptionIds.length === 0
      ? []
      : await db
          .select({
            id: productCategoryAttributeOptions.id,
            definitionId: productCategoryAttributeOptions.definitionId,
            code: productCategoryAttributeOptions.code,
            label: productCategoryAttributeOptions.label,
          })
          .from(productCategoryAttributeOptions)
          .where(
            and(
              eq(productCategoryAttributeOptions.tenantId, input.tenantId),
              inArray(productCategoryAttributeOptions.id, requestedOptionIds),
              eq(productCategoryAttributeOptions.status, "active"),
              isNull(productCategoryAttributeOptions.deletedAt),
            ),
          )
          .for("share");
  const optionsById = new Map(optionRows.map((option) => [option.id, option]));

  return input.attributes.map((attribute) => {
    const definition = definitionsById.get(attribute.definitionId);

    if (!definition) {
      throw new TenantProductsError(
        "PRODUCT_CATEGORY_ATTRIBUTE_INVALID",
        "A category attribute does not belong to the selected category or is inactive.",
        422,
      );
    }

    if (definition.valueType === "text") {
      const textValue =
        typeof attribute.textValue === "string"
          ? attribute.textValue.trim()
          : "";

      if (!textValue || textValue.length > 1_000) {
        throw new TenantProductsError(
          "PRODUCT_CATEGORY_ATTRIBUTE_INVALID",
          `Category attribute "${definition.name}" requires a text value.`,
          422,
        );
      }

      return {
        definitionId: definition.id,
        definitionCode: definition.code,
        definitionName: definition.name,
        valueType: definition.valueType,
        textValue,
        options: [],
      };
    }

    if (!Array.isArray(attribute.optionIds)) {
      throw new TenantProductsError(
        "PRODUCT_CATEGORY_ATTRIBUTE_INVALID",
        `Category attribute "${definition.name}" requires an option value.`,
        422,
      );
    }

    if (attribute.optionIds.length === 0) {
      throw new TenantProductsError(
        "PRODUCT_CATEGORY_ATTRIBUTE_INVALID",
        `Category attribute "${definition.name}" requires at least one option.`,
        422,
      );
    }

    if (new Set(attribute.optionIds).size !== attribute.optionIds.length) {
      throw new TenantProductsError(
        "PRODUCT_CATEGORY_ATTRIBUTE_INVALID",
        `Category attribute "${definition.name}" contains duplicate options.`,
        422,
      );
    }

    if (
      definition.valueType === "single_select" &&
      attribute.optionIds.length !== 1
    ) {
      throw new TenantProductsError(
        "PRODUCT_CATEGORY_ATTRIBUTE_INVALID",
        `Category attribute "${definition.name}" only accepts one option.`,
        422,
      );
    }

    const selectedOptions = attribute.optionIds.map((optionId) => {
      const option = optionsById.get(optionId);

      if (!option || option.definitionId !== definition.id) {
        throw new TenantProductsError(
          "PRODUCT_CATEGORY_ATTRIBUTE_INVALID",
          `An option for category attribute "${definition.name}" is invalid or inactive.`,
          422,
        );
      }

      return {
        id: option.id,
        code: option.code,
        label: option.label,
      };
    });

    return {
      definitionId: definition.id,
      definitionCode: definition.code,
      definitionName: definition.name,
      valueType: definition.valueType,
      textValue: null,
      options: selectedOptions,
    };
  });
}

export async function createTenantProductRecord(
  db: Database,
  input: CreateTenantProductRecordInput,
): Promise<CreateTenantProductResponse> {
  try {
    return await db.transaction(async (tx) => {
      const branchIds = input.branchSettings.map((setting) => setting.branchId);

      await requireProductBranches(tx, {
        tenantId: input.tenantId,
        branchIds,
      });
      await requireUniqueSkuIdentifiers(tx, input);
      const lockedMediaObjects = await lockPendingProductMediaObjects(tx, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        objectKeys: input.mediaObjectKeys,
      });

      const category = await resolveProductCategory(tx, input);
      const categoryId = category.id;
      const resolvedCategoryAttributes = await resolveProductCategoryAttributes(
        tx,
        {
          tenantId: input.tenantId,
          categoryId,
          attributes: input.categoryAttributes,
        },
      );
      const productId = createId();
      const productSkuId = createId();
      const now = new Date();
      const referenceCost = input.referenceCost ?? null;

      await tx.insert(products).values({
        id: productId,
        tenantId: input.tenantId,
        categoryId,
        name: input.name,
        brand: normalizeNullable(input.brand),
        description: normalizeNullable(input.description),
        tags: input.tags,
        status: input.status,
        createdAt: now,
        updatedAt: now,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId,
      });

      if (resolvedCategoryAttributes.length > 0) {
        const attributeValueRecords = resolvedCategoryAttributes.map(
          (attribute) => ({
            id: createId(),
            attribute,
          }),
        );

        await tx.insert(productAttributeValues).values(
          attributeValueRecords.map(({ id, attribute }) => ({
            id,
            tenantId: input.tenantId,
            productId,
            definitionId: attribute.definitionId,
            textValue: attribute.textValue,
            createdAt: now,
            updatedAt: now,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId,
          })),
        );

        const selectedOptionRecords = attributeValueRecords.flatMap(
          ({ id: attributeValueId, attribute }) =>
            attribute.options.map((option) => ({
              id: createId(),
              tenantId: input.tenantId,
              attributeValueId,
              definitionId: attribute.definitionId,
              optionId: option.id,
              createdAt: now,
              createdBy: input.actorUserId,
            })),
        );

        if (selectedOptionRecords.length > 0) {
          await tx
            .insert(productAttributeValueOptions)
            .values(selectedOptionRecords);
        }
      }

      await tx.insert(productSkus).values({
        id: productSkuId,
        tenantId: input.tenantId,
        productId,
        skuCode: input.skuCode,
        barcode: normalizeNullable(input.barcode),
        variantName: normalizeNullable(input.variantName),
        unitOfMeasure: input.unitOfMeasure,
        unitsPerSale: input.unitsPerSale,
        trackInventory: input.trackInventory,
        referenceCostAmount: referenceCost,
        costCurrency: referenceCost === null ? null : input.currency,
        status: input.status,
        createdAt: now,
        updatedAt: now,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId,
      });

      await tx.insert(productPrices).values(
        (input.createTenantDefaultPrice ? [null] : branchIds).map(
          (branchId) => ({
            id: createId(),
            tenantId: input.tenantId,
            branchId,
            productSkuId,
            amount: input.salePrice,
            currency: input.currency,
            status: input.status,
            createdAt: now,
            updatedAt: now,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId,
          }),
        ),
      );

      await tx.insert(branchProductSettings).values(
        input.branchSettings.map((setting) => ({
          id: createId(),
          tenantId: input.tenantId,
          branchId: setting.branchId,
          productSkuId,
          isAvailable: true,
          allowNegativeStock: input.allowNegativeStock,
          allowOfflineSale: input.allowOfflineSale,
          reorderPoint: setting.reorderPoint,
          createdAt: now,
          updatedAt: now,
          createdBy: input.actorUserId,
          updatedBy: input.actorUserId,
        })),
      );

      if (input.trackInventory) {
        await tx.insert(inventoryBalances).values(
          input.branchSettings.map((setting) => ({
            id: createId(),
            tenantId: input.tenantId,
            branchId: setting.branchId,
            productSkuId,
            onHandQuantity: setting.openingStock,
            reservedQuantity: "0",
            averageUnitCost: referenceCost,
            currency: referenceCost === null ? null : input.currency,
            lastMovementAt: Number(setting.openingStock) > 0 ? now : null,
            createdAt: now,
            updatedAt: now,
            updatedBy: input.actorUserId,
          })),
        );

        const openingStockSettings = input.branchSettings.filter(
          (setting) => Number(setting.openingStock) > 0,
        );

        if (openingStockSettings.length > 0) {
          await tx.insert(inventoryMovements).values(
            openingStockSettings.map((setting) => ({
              id: createId(),
              tenantId: input.tenantId,
              branchId: setting.branchId,
              productSkuId,
              movementType: "opening" as const,
              quantityDelta: setting.openingStock,
              unitCost: referenceCost,
              currency: referenceCost === null ? null : input.currency,
              referenceType: "product_creation",
              referenceId: productId,
              idempotencyKey: `product:${productId}:${setting.branchId}:opening`,
              reason: "Opening stock recorded during product creation.",
              occurredAt: now,
              serverReceivedAt: now,
              createdAt: now,
              createdBy: input.actorUserId,
            })),
          );
        }
      }

      if (lockedMediaObjects.length > 0) {
        await tx.insert(productMedia).values(
          lockedMediaObjects.map((mediaObject, index) => ({
            id: createId(),
            tenantId: input.tenantId,
            productId,
            productSkuId: null,
            mediaObjectId: mediaObject.id,
            isPrimary: index === 0,
            sortOrder: index,
            createdAt: now,
            createdBy: input.actorUserId,
          })),
        );

        const committedRows = await tx
          .update(mediaObjects)
          .set({
            status: "committed",
            committedAt: now,
            cleanupClaimToken: null,
            cleanupClaimedAt: null,
          })
          .where(
            and(
              eq(mediaObjects.tenantId, input.tenantId),
              inArray(
                mediaObjects.id,
                lockedMediaObjects.map((mediaObject) => mediaObject.id),
              ),
              eq(mediaObjects.status, "pending"),
              isNull(mediaObjects.deletedAt),
            ),
          )
          .returning({ id: mediaObjects.id });

        if (committedRows.length !== lockedMediaObjects.length) {
          throw new TenantProductsError(
            "PRODUCT_MEDIA_CONFLICT",
            "One or more product images have already been used.",
            409,
          );
        }
      }

      if (category.reactivated && categoryId) {
        await writeAuditLog(tx, {
          actorUserId: input.actorUserId,
          tenantId: input.tenantId,
          eventCategory: "tenant_product_category",
          eventType: "product_category.reactivated",
          entityType: "product_category",
          entityId: categoryId,
          before: {
            id: categoryId,
            name: input.categoryName,
            status: "inactive",
          },
          after: {
            id: categoryId,
            name: input.categoryName,
            status: "active",
          },
          ipAddress: input.requestMeta?.ipAddress,
          userAgent: input.requestMeta?.userAgent,
        });
      }

      await writeAuditLog(tx, {
        actorUserId: input.actorUserId,
        tenantId: input.tenantId,
        eventCategory: "tenant_product",
        eventType: "product.created",
        entityType: "product",
        entityId: productId,
        after: {
          id: productId,
          name: input.name,
          brand: normalizeNullable(input.brand),
          description: normalizeNullable(input.description),
          categoryId,
          categoryName: category.name,
          categoryCode: category.code,
          categoryAttributes: resolvedCategoryAttributes.map((attribute) => ({
            definitionId: attribute.definitionId,
            code: attribute.definitionCode,
            name: attribute.definitionName,
            valueType: attribute.valueType,
            textValue: attribute.textValue,
            options: attribute.options,
          })),
          tags: input.tags,
          status: input.status,
          productSkuId,
          skuCode: input.skuCode,
          barcode: normalizeNullable(input.barcode),
          variantName: normalizeNullable(input.variantName),
          unitOfMeasure: input.unitOfMeasure,
          unitsPerSale: input.unitsPerSale,
          salePrice: input.salePrice,
          currency: input.currency,
          referenceCost,
          priceScope: input.createTenantDefaultPrice
            ? "tenant_default"
            : "branch_override",
          trackInventory: input.trackInventory,
          allowNegativeStock: input.allowNegativeStock,
          allowOfflineSale: input.allowOfflineSale,
          branchSettings: input.branchSettings,
          mediaObjectKeys: input.mediaObjectKeys,
        },
        ipAddress: input.requestMeta?.ipAddress,
        userAgent: input.requestMeta?.userAgent,
      });

      return { id: productId };
    });
  } catch (error) {
    if (error instanceof TenantProductsError) {
      throw error;
    }

    const productError = mapProductCreateConstraint(error);

    if (productError) {
      throw productError;
    }

    throw error;
  }
}

function quantityToMillis(value: string): bigint {
  const negative = value.startsWith("-");
  const unsignedValue = negative ? value.slice(1) : value;
  const [integerPart, decimalPart = ""] = unsignedValue.split(".");
  const quantity =
    BigInt(integerPart ?? "0") * BigInt(1_000) +
    BigInt(decimalPart.padEnd(3, "0").slice(0, 3));
  return negative ? -quantity : quantity;
}

function millisToQuantity(value: bigint): string {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const integerPart = absolute / BigInt(1_000);
  const decimalPart = (absolute % BigInt(1_000)).toString().padStart(3, "0");

  return `${negative ? "-" : ""}${integerPart}.${decimalPart}`;
}

function moneyToCents(value: string): bigint {
  const [integerPart, decimalPart = ""] = value.split(".");

  return (
    BigInt(integerPart ?? "0") * BigInt(100) +
    BigInt(decimalPart.padEnd(2, "0").slice(0, 2))
  );
}

function nullableMoneyEquals(
  left: string | null,
  right: string | null,
): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  return moneyToCents(left) === moneyToCents(right);
}

export async function updateTenantProductRecord(
  db: Database,
  input: UpdateTenantProductRecordInput,
): Promise<TenantProductDetailRecord> {
  try {
    return await db.transaction(async (tx) => {
      const branchScopeFilter = buildProductBranchScopeFilter(
        input.allowedBranchIds,
      );
      const productRows = await tx
        .select({
          id: products.id,
          version: products.version,
        })
        .from(products)
        .where(
          and(
            eq(products.tenantId, input.tenantId),
            eq(products.id, input.productId),
            isNull(products.deletedAt),
            ...(branchScopeFilter ? [branchScopeFilter] : []),
          ),
        )
        .limit(1)
        .for("update");
      const product = productRows[0];

      if (!product) {
        throw new TenantProductsError(
          "PRODUCT_NOT_FOUND",
          "Product was not found.",
          404,
        );
      }

      if (product.version !== input.version) {
        throw new TenantProductsError(
          "PRODUCT_VERSION_CONFLICT",
          "Product has been modified. Refresh and try again.",
          409,
        );
      }

      const skuBranchScopeFilter = buildSkuBranchScopeFilter(
        input.allowedBranchIds,
      );
      const skuRows = await tx
        .select({
          id: productSkus.id,
          version: productSkus.version,
        })
        .from(productSkus)
        .where(
          and(
            eq(productSkus.tenantId, input.tenantId),
            eq(productSkus.productId, input.productId),
            eq(productSkus.id, input.skuId),
            isNull(productSkus.deletedAt),
            ...(skuBranchScopeFilter ? [skuBranchScopeFilter] : []),
          ),
        )
        .limit(1)
        .for("update");
      const sku = skuRows[0];

      if (!sku) {
        throw new TenantProductsError(
          "PRODUCT_SKU_NOT_FOUND",
          "Product SKU was not found.",
          404,
        );
      }

      if (sku.version !== input.skuVersion) {
        throw new TenantProductsError(
          "PRODUCT_SKU_VERSION_CONFLICT",
          "Product SKU has been modified. Refresh and try again.",
          409,
        );
      }

      const before = await findTenantProductDetailRecord(tx, {
        tenantId: input.tenantId,
        allowedBranchIds: input.allowedBranchIds,
        productId: input.productId,
        preferTenantDefaultPrice: input.updateTenantDefaultPrice,
      });

      if (!before) {
        throw new TenantProductsError(
          "PRODUCT_NOT_FOUND",
          "Product was not found.",
          404,
        );
      }

      const branchIds = input.branchSettings.map((setting) => setting.branchId);
      await requireProductBranches(tx, {
        tenantId: input.tenantId,
        branchIds,
      });
      await requireUniqueSkuIdentifiers(tx, {
        tenantId: input.tenantId,
        skuCode: input.skuCode,
        barcode: input.barcode,
        excludeSkuId: input.skuId,
      });

      const existingMediaRows = await tx
        .select({
          id: productMedia.id,
          mediaObjectId: productMedia.mediaObjectId,
        })
        .from(productMedia)
        .where(
          and(
            eq(productMedia.tenantId, input.tenantId),
            eq(productMedia.productId, input.productId),
            isNull(productMedia.productSkuId),
            isNull(productMedia.deletedAt),
          ),
        )
        .orderBy(asc(productMedia.id))
        .for("update");
      const existingMediaById = new Map(
        existingMediaRows.map((media) => [media.id, media]),
      );

      if (
        input.retainedMediaIds.some(
          (mediaId) => !existingMediaById.has(mediaId),
        )
      ) {
        throw new TenantProductsError(
          "PRODUCT_MEDIA_NOT_FOUND",
          "One or more retained product images were not found.",
          404,
        );
      }

      const lockedMediaObjects = await lockPendingProductMediaObjects(tx, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        objectKeys: input.newMediaObjectKeys,
      });
      const category = await resolveProductCategory(tx, input);
      const resolvedCategoryAttributes = await resolveProductCategoryAttributes(
        tx,
        {
          tenantId: input.tenantId,
          categoryId: category.id,
          attributes: input.categoryAttributes,
        },
      );
      const now = new Date();
      const referenceCost = input.referenceCost ?? null;
      const priceValuesChanged =
        moneyToCents(input.salePrice) !== moneyToCents(before.salePrice) ||
        input.currency !== before.currency;
      const priceStatusChanged = input.status !== before.status;
      const referenceCostChanged = !nullableMoneyEquals(
        referenceCost,
        before.sku.referenceCost,
      );
      const nextReferenceCostCurrency =
        referenceCost === null
          ? null
          : referenceCostChanged
            ? input.currency
            : (before.sku.referenceCostCurrency ?? input.currency);
      const representativeBranchSetting =
        before.branchSettings.find((setting) => setting.isAvailable) ??
        before.branchSettings[0];
      const negativeStockPolicyChanged =
        !representativeBranchSetting ||
        representativeBranchSetting.allowNegativeStock !==
          input.allowNegativeStock;
      const offlineSalePolicyChanged =
        !representativeBranchSetting ||
        representativeBranchSetting.allowOfflineSale !== input.allowOfflineSale;
      const inventoryTrackingChanged =
        before.sku.trackInventory !== input.trackInventory;
      const beforeBranchSettingByBranchId = new Map(
        before.branchSettings.map((setting) => [setting.branchId, setting]),
      );

      const updatedProductRows = await tx
        .update(products)
        .set({
          categoryId: category.id,
          name: input.name,
          brand: normalizeNullable(input.brand),
          description: normalizeNullable(input.description),
          tags: input.tags,
          status: input.status,
          updatedAt: now,
          updatedBy: input.actorUserId,
          version: sql`${products.version} + 1`,
        })
        .where(
          and(
            eq(products.tenantId, input.tenantId),
            eq(products.id, input.productId),
            eq(products.version, input.version),
            isNull(products.deletedAt),
          ),
        )
        .returning({ id: products.id });

      if (!updatedProductRows[0]) {
        throw new TenantProductsError(
          "PRODUCT_VERSION_CONFLICT",
          "Product has been modified. Refresh and try again.",
          409,
        );
      }

      const existingAttributeValueRows = await tx
        .select({ id: productAttributeValues.id })
        .from(productAttributeValues)
        .where(
          and(
            eq(productAttributeValues.tenantId, input.tenantId),
            eq(productAttributeValues.productId, input.productId),
            isNull(productAttributeValues.deletedAt),
          ),
        )
        .for("update");
      const existingAttributeValueIds = existingAttributeValueRows.map(
        (attribute) => attribute.id,
      );

      if (existingAttributeValueIds.length > 0) {
        await tx
          .update(productAttributeValueOptions)
          .set({
            deletedAt: now,
            deletedBy: input.actorUserId,
          })
          .where(
            and(
              eq(productAttributeValueOptions.tenantId, input.tenantId),
              inArray(
                productAttributeValueOptions.attributeValueId,
                existingAttributeValueIds,
              ),
              isNull(productAttributeValueOptions.deletedAt),
            ),
          );
        await tx
          .update(productAttributeValues)
          .set({
            updatedAt: now,
            updatedBy: input.actorUserId,
            deletedAt: now,
            deletedBy: input.actorUserId,
            version: sql`${productAttributeValues.version} + 1`,
          })
          .where(
            and(
              eq(productAttributeValues.tenantId, input.tenantId),
              inArray(productAttributeValues.id, existingAttributeValueIds),
              isNull(productAttributeValues.deletedAt),
            ),
          );
      }

      if (resolvedCategoryAttributes.length > 0) {
        const attributeValueRecords = resolvedCategoryAttributes.map(
          (attribute) => ({
            id: createId(),
            attribute,
          }),
        );

        await tx.insert(productAttributeValues).values(
          attributeValueRecords.map(({ id, attribute }) => ({
            id,
            tenantId: input.tenantId,
            productId: input.productId,
            definitionId: attribute.definitionId,
            textValue: attribute.textValue,
            createdAt: now,
            updatedAt: now,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId,
          })),
        );

        const selectedOptionRecords = attributeValueRecords.flatMap(
          ({ id: attributeValueId, attribute }) =>
            attribute.options.map((option) => ({
              id: createId(),
              tenantId: input.tenantId,
              attributeValueId,
              definitionId: attribute.definitionId,
              optionId: option.id,
              createdAt: now,
              createdBy: input.actorUserId,
            })),
        );

        if (selectedOptionRecords.length > 0) {
          await tx
            .insert(productAttributeValueOptions)
            .values(selectedOptionRecords);
        }
      }

      const updatedSkuRows = await tx
        .update(productSkus)
        .set({
          skuCode: input.skuCode,
          barcode: normalizeNullable(input.barcode),
          variantName: normalizeNullable(input.variantName),
          unitOfMeasure: input.unitOfMeasure,
          unitsPerSale: input.unitsPerSale,
          trackInventory: input.trackInventory,
          referenceCostAmount: referenceCost,
          costCurrency: nextReferenceCostCurrency,
          status: input.status,
          updatedAt: now,
          updatedBy: input.actorUserId,
          version: sql`${productSkus.version} + 1`,
        })
        .where(
          and(
            eq(productSkus.tenantId, input.tenantId),
            eq(productSkus.productId, input.productId),
            eq(productSkus.id, input.skuId),
            eq(productSkus.version, input.skuVersion),
            isNull(productSkus.deletedAt),
          ),
        )
        .returning({ id: productSkus.id });

      if (!updatedSkuRows[0]) {
        throw new TenantProductsError(
          "PRODUCT_SKU_VERSION_CONFLICT",
          "Product SKU has been modified. Refresh and try again.",
          409,
        );
      }

      const priceScopes: Array<string | null> = input.updateTenantDefaultPrice
        ? [null]
        : branchIds;

      for (const branchId of priceScopes) {
        const currentPriceRows = await tx
          .select({
            id: productPrices.id,
            amount: productPrices.amount,
            currency: productPrices.currency,
          })
          .from(productPrices)
          .where(
            and(
              eq(productPrices.tenantId, input.tenantId),
              eq(productPrices.productSkuId, input.skuId),
              branchId === null
                ? isNull(productPrices.branchId)
                : eq(productPrices.branchId, branchId),
              isNull(productPrices.deletedAt),
            ),
          )
          .orderBy(asc(productPrices.createdAt), asc(productPrices.id))
          .for("update");
        const wasPublished =
          branchId === null ||
          beforeBranchSettingByBranchId.get(branchId)?.isAvailable === true;
        const shouldApplyDisplayedPrice = priceValuesChanged || !wasPublished;
        const targetCurrencyPrice = currentPriceRows.find(
          (price) => price.currency === input.currency,
        );
        const sourceCurrencyPrice = currentPriceRows.find(
          (price) => price.currency === before.currency,
        );
        let appliedPriceId: string | null = null;

        if (shouldApplyDisplayedPrice && targetCurrencyPrice) {
          appliedPriceId = targetCurrencyPrice.id;
          await tx
            .update(productPrices)
            .set({
              amount: input.salePrice,
              status: input.status,
              updatedAt: now,
              updatedBy: input.actorUserId,
              version: sql`${productPrices.version} + 1`,
            })
            .where(
              and(
                eq(productPrices.tenantId, input.tenantId),
                eq(productPrices.id, targetCurrencyPrice.id),
                isNull(productPrices.deletedAt),
              ),
            );
        } else if (shouldApplyDisplayedPrice && sourceCurrencyPrice) {
          appliedPriceId = sourceCurrencyPrice.id;
          await tx
            .update(productPrices)
            .set({
              amount: input.salePrice,
              currency: input.currency,
              status: input.status,
              updatedAt: now,
              updatedBy: input.actorUserId,
              version: sql`${productPrices.version} + 1`,
            })
            .where(
              and(
                eq(productPrices.tenantId, input.tenantId),
                eq(productPrices.id, sourceCurrencyPrice.id),
                isNull(productPrices.deletedAt),
              ),
            );
        } else if (shouldApplyDisplayedPrice) {
          appliedPriceId = createId();
          await tx.insert(productPrices).values({
            id: appliedPriceId,
            tenantId: input.tenantId,
            branchId,
            productSkuId: input.skuId,
            amount: input.salePrice,
            currency: input.currency,
            status: input.status,
            createdAt: now,
            updatedAt: now,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId,
          });
        } else if (priceStatusChanged && currentPriceRows.length > 0) {
          await tx
            .update(productPrices)
            .set({
              status: input.status,
              updatedAt: now,
              updatedBy: input.actorUserId,
              version: sql`${productPrices.version} + 1`,
            })
            .where(
              and(
                eq(productPrices.tenantId, input.tenantId),
                inArray(
                  productPrices.id,
                  currentPriceRows.map((price) => price.id),
                ),
                isNull(productPrices.deletedAt),
              ),
            );
        }

        const shouldCollapseToDisplayedCurrency =
          shouldApplyDisplayedPrice &&
          (input.currency !== before.currency || !wasPublished);
        const supersededPriceIds =
          shouldCollapseToDisplayedCurrency && appliedPriceId
            ? currentPriceRows
                .filter((price) => price.id !== appliedPriceId)
                .map((price) => price.id)
            : [];

        if (supersededPriceIds.length > 0) {
          await tx
            .update(productPrices)
            .set({
              status: "inactive",
              updatedAt: now,
              updatedBy: input.actorUserId,
              deletedAt: now,
              deletedBy: input.actorUserId,
              version: sql`${productPrices.version} + 1`,
            })
            .where(
              and(
                eq(productPrices.tenantId, input.tenantId),
                inArray(productPrices.id, supersededPriceIds),
                isNull(productPrices.deletedAt),
              ),
            );
        }
      }

      const branchSettingFilters: SQL[] = [
        eq(branchProductSettings.tenantId, input.tenantId),
        eq(branchProductSettings.productSkuId, input.skuId),
      ];

      if (input.allowedBranchIds) {
        branchSettingFilters.push(
          input.allowedBranchIds.length === 0
            ? sql`false`
            : inArray(branchProductSettings.branchId, input.allowedBranchIds),
        );
      }

      const currentBranchSettingRows = await tx
        .select({
          id: branchProductSettings.id,
          branchId: branchProductSettings.branchId,
          isAvailable: branchProductSettings.isAvailable,
          allowNegativeStock: branchProductSettings.allowNegativeStock,
          allowOfflineSale: branchProductSettings.allowOfflineSale,
        })
        .from(branchProductSettings)
        .where(and(...branchSettingFilters))
        .orderBy(asc(branchProductSettings.branchId))
        .for("update");
      const currentBranchSettingByBranchId = new Map(
        currentBranchSettingRows.map((setting) => [setting.branchId, setting]),
      );
      const effectiveAllowNegativeStockByBranchId = new Map<string, boolean>();

      for (const setting of input.branchSettings) {
        const currentSetting = currentBranchSettingByBranchId.get(
          setting.branchId,
        );

        if (currentSetting) {
          const shouldApplyNegativeStockPolicy =
            !currentSetting.isAvailable ||
            negativeStockPolicyChanged ||
            (inventoryTrackingChanged && !input.trackInventory);
          const shouldApplyOfflineSalePolicy =
            !currentSetting.isAvailable || offlineSalePolicyChanged;
          const effectiveAllowNegativeStock = shouldApplyNegativeStockPolicy
            ? input.allowNegativeStock
            : currentSetting.allowNegativeStock;
          effectiveAllowNegativeStockByBranchId.set(
            setting.branchId,
            effectiveAllowNegativeStock,
          );

          await tx
            .update(branchProductSettings)
            .set({
              isAvailable: true,
              ...(shouldApplyNegativeStockPolicy
                ? { allowNegativeStock: input.allowNegativeStock }
                : {}),
              ...(shouldApplyOfflineSalePolicy
                ? { allowOfflineSale: input.allowOfflineSale }
                : {}),
              reorderPoint: setting.reorderPoint,
              updatedAt: now,
              updatedBy: input.actorUserId,
              version: sql`${branchProductSettings.version} + 1`,
            })
            .where(
              and(
                eq(branchProductSettings.tenantId, input.tenantId),
                eq(branchProductSettings.id, currentSetting.id),
              ),
            );
        } else {
          effectiveAllowNegativeStockByBranchId.set(
            setting.branchId,
            input.allowNegativeStock,
          );
          await tx.insert(branchProductSettings).values({
            id: createId(),
            tenantId: input.tenantId,
            branchId: setting.branchId,
            productSkuId: input.skuId,
            isAvailable: true,
            allowNegativeStock: input.allowNegativeStock,
            allowOfflineSale: input.allowOfflineSale,
            reorderPoint: setting.reorderPoint,
            createdAt: now,
            updatedAt: now,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId,
          });
        }
      }

      const unavailableSettingIds = currentBranchSettingRows
        .filter((setting) => !branchIds.includes(setting.branchId))
        .map((setting) => setting.id);

      if (unavailableSettingIds.length > 0) {
        await tx
          .update(branchProductSettings)
          .set({
            isAvailable: false,
            updatedAt: now,
            updatedBy: input.actorUserId,
            version: sql`${branchProductSettings.version} + 1`,
          })
          .where(
            and(
              eq(branchProductSettings.tenantId, input.tenantId),
              inArray(branchProductSettings.id, unavailableSettingIds),
            ),
          );
      }

      if (input.trackInventory) {
        const currentBalanceRows = await tx
          .select({
            id: inventoryBalances.id,
            branchId: inventoryBalances.branchId,
            onHandQuantity: inventoryBalances.onHandQuantity,
            reservedQuantity: inventoryBalances.reservedQuantity,
          })
          .from(inventoryBalances)
          .where(
            and(
              eq(inventoryBalances.tenantId, input.tenantId),
              eq(inventoryBalances.productSkuId, input.skuId),
              inArray(inventoryBalances.branchId, branchIds),
            ),
          )
          .orderBy(asc(inventoryBalances.branchId))
          .for("update");
        const currentBalanceByBranchId = new Map(
          currentBalanceRows.map((balance) => [balance.branchId, balance]),
        );

        for (const setting of input.branchSettings) {
          const currentBalance = currentBalanceByBranchId.get(setting.branchId);
          const currentOnHand = quantityToMillis(
            currentBalance?.onHandQuantity ?? "0",
          );
          const expectedOnHand = quantityToMillis(setting.expectedStockOnHand);
          const requestedOnHand = quantityToMillis(setting.stockOnHand);
          const reservedQuantity = quantityToMillis(
            currentBalance?.reservedQuantity ?? "0",
          );
          const stockWasEdited = requestedOnHand !== expectedOnHand;

          if (stockWasEdited && currentOnHand !== expectedOnHand) {
            throw new TenantProductsError(
              "PRODUCT_INVENTORY_CONFLICT",
              "Stock changed after this product was loaded. Refresh and try again.",
              409,
            );
          }

          // Saving unrelated product fields must not restore a stale stock
          // snapshot after a sale, receipt, or another adjustment.
          const targetOnHand = stockWasEdited ? requestedOnHand : currentOnHand;

          if (
            !effectiveAllowNegativeStockByBranchId.get(setting.branchId) &&
            targetOnHand < reservedQuantity
          ) {
            throw new TenantProductsError(
              "PRODUCT_INVENTORY_CONFLICT",
              "Stock on hand cannot be lower than the reserved quantity.",
              409,
            );
          }

          const delta = targetOnHand - currentOnHand;

          if (delta !== BigInt(0)) {
            await tx.insert(inventoryMovements).values({
              id: createId(),
              tenantId: input.tenantId,
              branchId: setting.branchId,
              productSkuId: input.skuId,
              movementType:
                delta > BigInt(0) ? "adjustment_in" : "adjustment_out",
              quantityDelta: millisToQuantity(delta),
              unitCost: referenceCost,
              currency: nextReferenceCostCurrency,
              referenceType: "product_update",
              referenceId: input.productId,
              idempotencyKey: `product-update:${createId()}`,
              reason: "Stock adjusted while updating the product.",
              occurredAt: now,
              serverReceivedAt: now,
              createdAt: now,
              createdBy: input.actorUserId,
            });
          }

          if (currentBalance) {
            if (delta !== BigInt(0)) {
              await tx
                .update(inventoryBalances)
                .set({
                  onHandQuantity: setting.stockOnHand,
                  lastMovementAt: now,
                  updatedAt: now,
                  updatedBy: input.actorUserId,
                  version: sql`${inventoryBalances.version} + 1`,
                })
                .where(
                  and(
                    eq(inventoryBalances.tenantId, input.tenantId),
                    eq(inventoryBalances.id, currentBalance.id),
                  ),
                );
            }
          } else {
            await tx.insert(inventoryBalances).values({
              id: createId(),
              tenantId: input.tenantId,
              branchId: setting.branchId,
              productSkuId: input.skuId,
              onHandQuantity: millisToQuantity(targetOnHand),
              reservedQuantity: "0",
              averageUnitCost: referenceCost,
              currency: nextReferenceCostCurrency,
              lastMovementAt: delta === BigInt(0) ? null : now,
              createdAt: now,
              updatedAt: now,
              updatedBy: input.actorUserId,
            });
          }
        }
      }

      if (existingMediaRows.length > 0) {
        await tx
          .update(productMedia)
          .set({ isPrimary: false })
          .where(
            and(
              eq(productMedia.tenantId, input.tenantId),
              eq(productMedia.productId, input.productId),
              isNull(productMedia.productSkuId),
              isNull(productMedia.deletedAt),
            ),
          );
      }

      const retainedMediaIdSet = new Set(input.retainedMediaIds);
      const removedMediaRows = existingMediaRows.filter(
        (media) => !retainedMediaIdSet.has(media.id),
      );
      const removedMediaIds = removedMediaRows.map((media) => media.id);

      if (removedMediaIds.length > 0) {
        await tx
          .update(productMedia)
          .set({
            deletedAt: now,
            deletedBy: input.actorUserId,
          })
          .where(
            and(
              eq(productMedia.tenantId, input.tenantId),
              inArray(productMedia.id, removedMediaIds),
              isNull(productMedia.deletedAt),
            ),
          );

        // Object storage deletion happens outside this transaction. Mark
        // detached objects as an immediately reclaimable cleanup claim so the
        // media cleanup job can delete the bytes without risking a
        // database/object-storage split-brain during this update.
        await tx
          .update(mediaObjects)
          .set({
            status: "deleting",
            cleanupClaimToken: createId(),
            cleanupClaimedAt: new Date(0),
          })
          .where(
            and(
              eq(mediaObjects.tenantId, input.tenantId),
              inArray(
                mediaObjects.id,
                removedMediaRows.map((media) => media.mediaObjectId),
              ),
              eq(mediaObjects.status, "committed"),
              isNull(mediaObjects.deletedAt),
            ),
          );
      }

      for (const [index, mediaId] of input.retainedMediaIds.entries()) {
        await tx
          .update(productMedia)
          .set({
            isPrimary: index === 0,
            sortOrder: index,
          })
          .where(
            and(
              eq(productMedia.tenantId, input.tenantId),
              eq(productMedia.id, mediaId),
              isNull(productMedia.deletedAt),
            ),
          );
      }

      if (lockedMediaObjects.length > 0) {
        await tx.insert(productMedia).values(
          lockedMediaObjects.map((mediaObject, index) => {
            const sortOrder = input.retainedMediaIds.length + index;

            return {
              id: createId(),
              tenantId: input.tenantId,
              productId: input.productId,
              productSkuId: null,
              mediaObjectId: mediaObject.id,
              isPrimary: sortOrder === 0,
              sortOrder,
              createdAt: now,
              createdBy: input.actorUserId,
            };
          }),
        );

        const committedRows = await tx
          .update(mediaObjects)
          .set({
            status: "committed",
            committedAt: now,
            cleanupClaimToken: null,
            cleanupClaimedAt: null,
          })
          .where(
            and(
              eq(mediaObjects.tenantId, input.tenantId),
              inArray(
                mediaObjects.id,
                lockedMediaObjects.map((mediaObject) => mediaObject.id),
              ),
              eq(mediaObjects.status, "pending"),
              isNull(mediaObjects.deletedAt),
            ),
          )
          .returning({ id: mediaObjects.id });

        if (committedRows.length !== lockedMediaObjects.length) {
          throw new TenantProductsError(
            "PRODUCT_MEDIA_CONFLICT",
            "One or more product images have already been used.",
            409,
          );
        }
      }

      if (category.reactivated && category.id) {
        await writeAuditLog(tx, {
          actorUserId: input.actorUserId,
          tenantId: input.tenantId,
          eventCategory: "tenant_product_category",
          eventType: "product_category.reactivated",
          entityType: "product_category",
          entityId: category.id,
          before: {
            id: category.id,
            name: input.categoryName,
            status: "inactive",
          },
          after: {
            id: category.id,
            name: input.categoryName,
            status: "active",
          },
          ipAddress: input.requestMeta?.ipAddress,
          userAgent: input.requestMeta?.userAgent,
        });
      }

      const after = await findTenantProductDetailRecord(tx, {
        tenantId: input.tenantId,
        allowedBranchIds: input.allowedBranchIds,
        productId: input.productId,
        preferTenantDefaultPrice: input.updateTenantDefaultPrice,
      });

      if (!after) {
        throw new TenantProductsError(
          "PRODUCT_NOT_FOUND",
          "Product was not found after it was updated.",
          404,
        );
      }

      await writeAuditLog(tx, {
        actorUserId: input.actorUserId,
        tenantId: input.tenantId,
        eventCategory: "tenant_product",
        eventType: "product.updated",
        entityType: "product",
        entityId: input.productId,
        before,
        after,
        ipAddress: input.requestMeta?.ipAddress,
        userAgent: input.requestMeta?.userAgent,
      });

      return after;
    });
  } catch (error) {
    if (error instanceof TenantProductsError) {
      throw error;
    }

    const productError = mapProductCreateConstraint(error);

    if (productError) {
      throw productError;
    }

    throw error;
  }
}

function buildProductFilters(input: ProductFilterInput): SQL[] {
  const filters: SQL[] = [
    eq(products.tenantId, input.tenantId),
    isNull(products.deletedAt),
  ];
  const branchScopeFilter = buildProductBranchScopeFilter(
    input.allowedBranchIds,
  );

  if (branchScopeFilter) {
    filters.push(branchScopeFilter);
  }
  if (input.q) {
    const pattern = `%${input.q.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
    filters.push(
      or(
        sql`${products.id} ilike ${pattern} escape '\\'`,
        sql`${products.name} ilike ${pattern} escape '\\'`,
        sql`${products.brand} ilike ${pattern} escape '\\'`,
        sql`${products.description} ilike ${pattern} escape '\\'`,
        sql`${products.tags}::text ilike ${pattern} escape '\\'`,
        sql`exists (
          select 1 from ${productSkus}
          where ${productSkus.tenantId} = ${products.tenantId}
            and ${productSkus.productId} = ${products.id}
            and ${productSkus.deletedAt} is null
            and (
              ${productSkus.skuCode} ilike ${pattern} escape '\\'
              or ${productSkus.barcode} ilike ${pattern} escape '\\'
              or ${productSkus.variantName} ilike ${pattern} escape '\\'
            )
        )`,
      )!,
    );
  }
  if (input.status) {
    filters.push(eq(products.status, input.status));
  }
  if (input.createdAfter) {
    filters.push(gte(products.createdAt, new Date(input.createdAfter)));
  }
  if (input.createdBefore) {
    filters.push(lt(products.createdAt, new Date(input.createdBefore)));
  }

  return filters;
}

function orderProductSkus(rows: ProductSkuRow[]): ProductSkuRow[] {
  return [...rows].sort((left, right) => {
    const statusDifference =
      Number(left.status !== "active") - Number(right.status !== "active");

    if (statusDifference !== 0) {
      return statusDifference;
    }

    const createdAtDifference =
      left.createdAt.getTime() - right.createdAt.getTime();

    return createdAtDifference || left.id.localeCompare(right.id);
  });
}

function sumQuantities(values: string[]): string {
  return values.reduce((total, value) => total + Number(value), 0).toFixed(3);
}

function buildPriceRanges(
  rows: Array<{ amount: string; currency: string }>,
): TenantProductPriceRange[] {
  const ranges = new Map<string, TenantProductPriceRange>();

  for (const row of rows) {
    const current = ranges.get(row.currency);

    if (!current) {
      ranges.set(row.currency, {
        currency: row.currency,
        minAmount: row.amount,
        maxAmount: row.amount,
      });
      continue;
    }

    if (Number(row.amount) < Number(current.minAmount)) {
      current.minAmount = row.amount;
    }
    if (Number(row.amount) > Number(current.maxAmount)) {
      current.maxAmount = row.amount;
    }
  }

  return [...ranges.values()].sort((left, right) =>
    left.currency.localeCompare(right.currency),
  );
}

function resolveEffectiveSkuPrices(
  rows: ProductPriceRow[],
  branchIds: string[],
): Array<{ amount: string; currency: string }> {
  const pricesByCurrency = new Map<
    string,
    {
      defaultPrice?: ProductPriceRow;
      branchPrices: Map<string, ProductPriceRow>;
    }
  >();

  for (const row of rows) {
    const prices = pricesByCurrency.get(row.currency) ?? {
      branchPrices: new Map<string, ProductPriceRow>(),
    };

    if (row.branchId) {
      prices.branchPrices.set(row.branchId, row);
    } else {
      prices.defaultPrice = row;
    }

    pricesByCurrency.set(row.currency, prices);
  }

  const effectivePrices: Array<{ amount: string; currency: string }> = [];

  for (const [currency, prices] of pricesByCurrency) {
    if (branchIds.length === 0) {
      if (prices.defaultPrice) {
        effectivePrices.push({
          amount: prices.defaultPrice.amount,
          currency,
        });
      }
      continue;
    }

    for (const branchId of branchIds) {
      const price = prices.branchPrices.get(branchId) ?? prices.defaultPrice;

      if (price) {
        effectivePrices.push({
          amount: price.amount,
          currency,
        });
      }
    }
  }

  return effectivePrices;
}

export async function findTenantProductCategories(
  db: Database,
  input: { tenantId: string },
): Promise<TenantProductCategoryListResponse> {
  const rows = await db
    .select({
      id: productCategories.id,
      name: productCategories.name,
      code: productCategories.code,
    })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.tenantId, input.tenantId),
        eq(productCategories.status, "active"),
        isNull(productCategories.deletedAt),
      ),
    )
    .orderBy(
      asc(productCategories.sortOrder),
      asc(productCategories.name),
      asc(productCategories.id),
    );

  return { data: rows };
}

export async function findTenantProductCategoryAttributes(
  db: Database,
  input: {
    tenantId: string;
    categoryId: string;
  },
): Promise<TenantProductCategoryAttributeListResponse> {
  const categoryRows = await db
    .select({
      id: productCategories.id,
      name: productCategories.name,
      code: productCategories.code,
      version: productCategories.version,
      status: productCategories.status,
    })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.tenantId, input.tenantId),
        eq(productCategories.id, input.categoryId),
        isNull(productCategories.deletedAt),
      ),
    )
    .limit(1);
  const category = categoryRows[0];

  if (!category) {
    throw new TenantProductsError(
      "PRODUCT_CATEGORY_NOT_FOUND",
      "Product category was not found.",
      404,
    );
  }

  if (category.status !== "active") {
    throw new TenantProductsError(
      "PRODUCT_CATEGORY_INACTIVE",
      "Product category is inactive.",
      422,
    );
  }

  const definitionRows = await db
    .select({
      id: productCategoryAttributeDefinitions.id,
      code: productCategoryAttributeDefinitions.code,
      name: productCategoryAttributeDefinitions.name,
      valueType: productCategoryAttributeDefinitions.valueType,
      required: productCategoryAttributeDefinitions.required,
      sortOrder: productCategoryAttributeDefinitions.sortOrder,
    })
    .from(productCategoryAttributeDefinitions)
    .where(
      and(
        eq(productCategoryAttributeDefinitions.tenantId, input.tenantId),
        eq(productCategoryAttributeDefinitions.categoryId, input.categoryId),
        eq(productCategoryAttributeDefinitions.status, "active"),
        isNull(productCategoryAttributeDefinitions.deletedAt),
      ),
    )
    .orderBy(
      asc(productCategoryAttributeDefinitions.sortOrder),
      asc(productCategoryAttributeDefinitions.id),
    );
  const definitionIds = definitionRows.map((definition) => definition.id);
  const optionRows =
    definitionIds.length === 0
      ? []
      : await db
          .select({
            id: productCategoryAttributeOptions.id,
            definitionId: productCategoryAttributeOptions.definitionId,
            code: productCategoryAttributeOptions.code,
            label: productCategoryAttributeOptions.label,
            sortOrder: productCategoryAttributeOptions.sortOrder,
          })
          .from(productCategoryAttributeOptions)
          .where(
            and(
              eq(productCategoryAttributeOptions.tenantId, input.tenantId),
              inArray(
                productCategoryAttributeOptions.definitionId,
                definitionIds,
              ),
              eq(productCategoryAttributeOptions.status, "active"),
              isNull(productCategoryAttributeOptions.deletedAt),
            ),
          )
          .orderBy(
            asc(productCategoryAttributeOptions.sortOrder),
            asc(productCategoryAttributeOptions.id),
          );
  const optionsByDefinitionId = new Map<
    string,
    TenantProductCategoryAttributeDefinition["options"]
  >();

  for (const option of optionRows) {
    const options = optionsByDefinitionId.get(option.definitionId) ?? [];

    options.push({
      id: option.id,
      code: option.code,
      label: option.label,
      sortOrder: option.sortOrder,
    });
    optionsByDefinitionId.set(option.definitionId, options);
  }

  return {
    category: {
      id: category.id,
      name: category.name,
      code: category.code,
      version: category.version,
    },
    data: definitionRows.map((definition) => ({
      id: definition.id,
      code: definition.code,
      name: definition.name,
      valueType: definition.valueType,
      required: definition.required,
      sortOrder: definition.sortOrder,
      options: optionsByDefinitionId.get(definition.id) ?? [],
    })),
  };
}

export async function findTenantProductDetailRecord(
  db: Database,
  input: TenantProductRepositoryScope & {
    productId: string;
    preferTenantDefaultPrice: boolean;
  },
): Promise<TenantProductDetailRecord | null> {
  const branchScopeFilter = buildProductBranchScopeFilter(
    input.allowedBranchIds,
  );
  const productRows = await db
    .select({
      id: products.id,
      version: products.version,
      name: products.name,
      categoryId: products.categoryId,
      categoryName: productCategories.name,
      brand: products.brand,
      description: products.description,
      tags: products.tags,
      status: products.status,
    })
    .from(products)
    .leftJoin(
      productCategories,
      and(
        eq(productCategories.tenantId, products.tenantId),
        eq(productCategories.id, products.categoryId),
        isNull(productCategories.deletedAt),
      ),
    )
    .where(
      and(
        eq(products.tenantId, input.tenantId),
        eq(products.id, input.productId),
        isNull(products.deletedAt),
        ...(branchScopeFilter ? [branchScopeFilter] : []),
      ),
    )
    .limit(1);
  const product = productRows[0];

  if (!product) {
    return null;
  }

  const skuBranchScopeFilter = buildSkuBranchScopeFilter(
    input.allowedBranchIds,
  );
  const skuRows = await db
    .select({
      id: productSkus.id,
      productId: productSkus.productId,
      version: productSkus.version,
      skuCode: productSkus.skuCode,
      barcode: productSkus.barcode,
      variantName: productSkus.variantName,
      unitOfMeasure: productSkus.unitOfMeasure,
      unitsPerSale: productSkus.unitsPerSale,
      trackInventory: productSkus.trackInventory,
      referenceCost: productSkus.referenceCostAmount,
      costCurrency: productSkus.costCurrency,
      status: productSkus.status,
      createdAt: productSkus.createdAt,
    })
    .from(productSkus)
    .where(
      and(
        eq(productSkus.tenantId, input.tenantId),
        eq(productSkus.productId, input.productId),
        isNull(productSkus.deletedAt),
        ...(skuBranchScopeFilter ? [skuBranchScopeFilter] : []),
      ),
    );

  if (skuRows.length === 0) {
    return null;
  }

  const orderedSkus = [...skuRows].sort((left, right) => {
    const createdAtDifference =
      left.createdAt.getTime() - right.createdAt.getTime();

    return createdAtDifference || left.id.localeCompare(right.id);
  });
  const primarySku = orderedSkus[0]!;
  const branchScope =
    input.allowedBranchIds === undefined
      ? []
      : input.allowedBranchIds.length === 0
        ? [sql`false`]
        : [inArray(branchProductSettings.branchId, input.allowedBranchIds)];
  const priceBranchScope =
    input.allowedBranchIds === undefined
      ? []
      : input.allowedBranchIds.length === 0
        ? [isNull(productPrices.branchId)]
        : [
            or(
              isNull(productPrices.branchId),
              inArray(productPrices.branchId, input.allowedBranchIds),
            )!,
          ];
  // Keep these reads sequential because this repository is also used from an
  // open transaction. The pg driver does not support concurrent queries on a
  // single transaction client.
  const skuCountRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productSkus)
    .where(
      and(
        eq(productSkus.tenantId, input.tenantId),
        eq(productSkus.productId, input.productId),
        isNull(productSkus.deletedAt),
      ),
    );
  const attributeValueRows = await db
    .select({
      id: productAttributeValues.id,
      definitionId: productAttributeValues.definitionId,
      textValue: productAttributeValues.textValue,
    })
    .from(productAttributeValues)
    .where(
      and(
        eq(productAttributeValues.tenantId, input.tenantId),
        eq(productAttributeValues.productId, input.productId),
        isNull(productAttributeValues.deletedAt),
      ),
    )
    .orderBy(
      asc(productAttributeValues.createdAt),
      asc(productAttributeValues.id),
    );
  const priceRows = await db
    .select({
      id: productPrices.id,
      branchId: productPrices.branchId,
      amount: productPrices.amount,
      currency: productPrices.currency,
      createdAt: productPrices.createdAt,
    })
    .from(productPrices)
    .where(
      and(
        eq(productPrices.tenantId, input.tenantId),
        eq(productPrices.productSkuId, primarySku.id),
        isNull(productPrices.deletedAt),
        ...priceBranchScope,
      ),
    );
  const branchSettingRows = await db
    .select({
      branchId: branchProductSettings.branchId,
      isAvailable: branchProductSettings.isAvailable,
      reorderPoint: branchProductSettings.reorderPoint,
      allowNegativeStock: branchProductSettings.allowNegativeStock,
      allowOfflineSale: branchProductSettings.allowOfflineSale,
      onHandQuantity: inventoryBalances.onHandQuantity,
      reservedQuantity: inventoryBalances.reservedQuantity,
    })
    .from(branchProductSettings)
    .leftJoin(
      inventoryBalances,
      and(
        eq(inventoryBalances.tenantId, branchProductSettings.tenantId),
        eq(inventoryBalances.branchId, branchProductSettings.branchId),
        eq(inventoryBalances.productSkuId, branchProductSettings.productSkuId),
      ),
    )
    .where(
      and(
        eq(branchProductSettings.tenantId, input.tenantId),
        eq(branchProductSettings.productSkuId, primarySku.id),
        ...branchScope,
      ),
    )
    .orderBy(asc(branchProductSettings.branchId));
  const mediaRows = await db
    .select({
      id: productMedia.id,
      objectKey: mediaObjects.objectKey,
      isPrimary: productMedia.isPrimary,
      sortOrder: productMedia.sortOrder,
    })
    .from(productMedia)
    .innerJoin(
      mediaObjects,
      and(
        eq(mediaObjects.tenantId, productMedia.tenantId),
        eq(mediaObjects.id, productMedia.mediaObjectId),
        eq(mediaObjects.status, "committed"),
        isNull(mediaObjects.deletedAt),
      ),
    )
    .where(
      and(
        eq(productMedia.tenantId, input.tenantId),
        eq(productMedia.productId, input.productId),
        isNull(productMedia.productSkuId),
        isNull(productMedia.deletedAt),
      ),
    )
    .orderBy(
      desc(productMedia.isPrimary),
      asc(productMedia.sortOrder),
      asc(productMedia.id),
    );
  const attributeValueIds = attributeValueRows.map((row) => row.id);
  const attributeOptionRows =
    attributeValueIds.length === 0
      ? []
      : await db
          .select({
            attributeValueId: productAttributeValueOptions.attributeValueId,
            optionId: productAttributeValueOptions.optionId,
          })
          .from(productAttributeValueOptions)
          .where(
            and(
              eq(productAttributeValueOptions.tenantId, input.tenantId),
              inArray(
                productAttributeValueOptions.attributeValueId,
                attributeValueIds,
              ),
              isNull(productAttributeValueOptions.deletedAt),
            ),
          )
          .orderBy(
            asc(productAttributeValueOptions.createdAt),
            asc(productAttributeValueOptions.id),
          );
  const optionIdsByAttributeValueId = new Map<string, string[]>();

  for (const option of attributeOptionRows) {
    const optionIds =
      optionIdsByAttributeValueId.get(option.attributeValueId) ?? [];
    optionIds.push(option.optionId);
    optionIdsByAttributeValueId.set(option.attributeValueId, optionIds);
  }

  const categoryAttributes: CreateTenantProductCategoryAttribute[] =
    attributeValueRows.map((attribute) =>
      attribute.textValue !== null
        ? {
            definitionId: attribute.definitionId,
            textValue: attribute.textValue,
          }
        : {
            definitionId: attribute.definitionId,
            optionIds: optionIdsByAttributeValueId.get(attribute.id) ?? [],
          },
    );
  const sortedPrices = [...priceRows].sort((left, right) => {
    const leftPreferred = input.preferTenantDefaultPrice
      ? left.branchId === null
      : left.branchId !== null;
    const rightPreferred = input.preferTenantDefaultPrice
      ? right.branchId === null
      : right.branchId !== null;

    return (
      Number(rightPreferred) - Number(leftPreferred) ||
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id.localeCompare(right.id)
    );
  });
  const selectedPrice = sortedPrices[0] ?? null;

  return {
    id: product.id,
    version: product.version,
    name: product.name,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    brand: product.brand,
    description: product.description,
    tags: product.tags,
    status: product.status,
    skuCount: skuCountRows[0]?.count ?? skuRows.length,
    sku: {
      id: primarySku.id,
      version: primarySku.version,
      skuCode: primarySku.skuCode,
      barcode: primarySku.barcode,
      variantName: primarySku.variantName,
      unitOfMeasure: primarySku.unitOfMeasure,
      unitsPerSale: primarySku.unitsPerSale,
      trackInventory: primarySku.trackInventory,
      referenceCost: primarySku.referenceCost,
      referenceCostCurrency: primarySku.costCurrency,
    },
    salePrice: selectedPrice?.amount ?? "0.00",
    currency: selectedPrice?.currency ?? primarySku.costCurrency ?? "CNY",
    branchSettings: branchSettingRows.map((setting) => ({
      branchId: setting.branchId,
      isAvailable: setting.isAvailable,
      reorderPoint: setting.reorderPoint,
      onHandQuantity: setting.onHandQuantity ?? "0.000",
      reservedQuantity: setting.reservedQuantity ?? "0.000",
      allowNegativeStock: setting.allowNegativeStock,
      allowOfflineSale: setting.allowOfflineSale,
    })),
    categoryAttributes,
    media: mediaRows,
  };
}

export async function findTenantProductMediaRecords(
  db: Database,
  input: TenantProductRepositoryScope & {
    items: Array<{
      productId: string;
      mediaId: string;
    }>;
  },
): Promise<
  Array<{
    productId: string;
    mediaId: string;
    objectKey: string;
  }>
> {
  if (input.items.length === 0) {
    return [];
  }

  const branchScopeFilter = buildProductBranchScopeFilter(
    input.allowedBranchIds,
  );
  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const mediaIds = [...new Set(input.items.map((item) => item.mediaId))];
  const requestedPairs = new Set(
    input.items.map((item) => `${item.productId}:${item.mediaId}`),
  );
  const rows = await db
    .select({
      productId: productMedia.productId,
      mediaId: productMedia.id,
      objectKey: mediaObjects.objectKey,
    })
    .from(productMedia)
    .innerJoin(
      products,
      and(
        eq(products.tenantId, productMedia.tenantId),
        eq(products.id, productMedia.productId),
        isNull(products.deletedAt),
      ),
    )
    .innerJoin(
      mediaObjects,
      and(
        eq(mediaObjects.tenantId, productMedia.tenantId),
        eq(mediaObjects.id, productMedia.mediaObjectId),
        eq(mediaObjects.status, "committed"),
        isNull(mediaObjects.deletedAt),
      ),
    )
    .where(
      and(
        eq(productMedia.tenantId, input.tenantId),
        inArray(productMedia.productId, productIds),
        inArray(productMedia.id, mediaIds),
        isNull(productMedia.productSkuId),
        isNull(productMedia.deletedAt),
        ...(branchScopeFilter ? [branchScopeFilter] : []),
      ),
    );

  return rows.filter((row) =>
    requestedPairs.has(`${row.productId}:${row.mediaId}`),
  );
}

async function findLowStockSkuIds(
  db: Database,
  input: TenantProductRepositoryScope &
    TenantProductOverviewQuery & { productIds?: string[] },
): Promise<Set<string>> {
  if (input.allowedBranchIds?.length === 0 || input.productIds?.length === 0) {
    return new Set();
  }

  const filters: SQL[] = [
    eq(products.tenantId, input.tenantId),
    eq(products.status, "active"),
    isNull(products.deletedAt),
    eq(productSkus.tenantId, input.tenantId),
    eq(productSkus.status, "active"),
    eq(productSkus.trackInventory, true),
    isNull(productSkus.deletedAt),
    eq(branchProductSettings.tenantId, input.tenantId),
    eq(branchProductSettings.isAvailable, true),
    sql`coalesce(${inventoryBalances.onHandQuantity}, 0) -
      coalesce(${inventoryBalances.reservedQuantity}, 0)
      <= ${branchProductSettings.reorderPoint}`,
  ];

  if (input.allowedBranchIds) {
    filters.push(
      inArray(branchProductSettings.branchId, input.allowedBranchIds),
    );
  }
  if (input.productIds) {
    filters.push(inArray(products.id, input.productIds));
  }
  if (input.createdAfter) {
    filters.push(gte(products.createdAt, new Date(input.createdAfter)));
  }
  if (input.createdBefore) {
    filters.push(lt(products.createdAt, new Date(input.createdBefore)));
  }

  const rows = await db
    .selectDistinct({ productSkuId: productSkus.id })
    .from(branchProductSettings)
    .innerJoin(
      productSkus,
      and(
        eq(productSkus.tenantId, branchProductSettings.tenantId),
        eq(productSkus.id, branchProductSettings.productSkuId),
      ),
    )
    .innerJoin(
      products,
      and(
        eq(products.tenantId, productSkus.tenantId),
        eq(products.id, productSkus.productId),
      ),
    )
    .leftJoin(
      inventoryBalances,
      and(
        eq(inventoryBalances.tenantId, branchProductSettings.tenantId),
        eq(inventoryBalances.branchId, branchProductSettings.branchId),
        eq(inventoryBalances.productSkuId, branchProductSettings.productSkuId),
      ),
    )
    .where(and(...filters));

  return new Set(rows.map((row) => row.productSkuId));
}

export async function findTenantProducts(
  db: Database,
  input: TenantProductListQuery & TenantProductRepositoryScope,
): Promise<TenantProductListResponse> {
  const filters = buildProductFilters(input);
  const [productRows, countRows] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        brand: products.brand,
        categoryId: products.categoryId,
        categoryName: productCategories.name,
        tags: products.tags,
        status: products.status,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        version: products.version,
      })
      .from(products)
      .leftJoin(
        productCategories,
        and(
          eq(productCategories.tenantId, products.tenantId),
          eq(productCategories.id, products.categoryId),
          isNull(productCategories.deletedAt),
        ),
      )
      .where(and(...filters))
      .orderBy(desc(products.createdAt), desc(products.id))
      .limit(input.limit)
      .offset(input.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(and(...filters)),
  ]);

  const total = countRows[0]?.count ?? 0;

  if (productRows.length === 0) {
    return { data: [], total };
  }

  const productIds = productRows.map((product) => product.id);
  const skuBranchScopeFilter = buildSkuBranchScopeFilter(
    input.allowedBranchIds,
  );
  const [skuRows, mediaRows] = await Promise.all([
    db
      .select({
        id: productSkus.id,
        productId: productSkus.productId,
        skuCode: productSkus.skuCode,
        barcode: productSkus.barcode,
        status: productSkus.status,
        trackInventory: productSkus.trackInventory,
        createdAt: productSkus.createdAt,
      })
      .from(productSkus)
      .where(
        and(
          eq(productSkus.tenantId, input.tenantId),
          inArray(productSkus.productId, productIds),
          isNull(productSkus.deletedAt),
          ...(skuBranchScopeFilter ? [skuBranchScopeFilter] : []),
        ),
      ),
    db
      .select({
        id: productMedia.id,
        productId: productMedia.productId,
      })
      .from(productMedia)
      .innerJoin(
        mediaObjects,
        and(
          eq(mediaObjects.tenantId, productMedia.tenantId),
          eq(mediaObjects.id, productMedia.mediaObjectId),
          eq(mediaObjects.status, "committed"),
          isNull(mediaObjects.deletedAt),
        ),
      )
      .where(
        and(
          eq(productMedia.tenantId, input.tenantId),
          inArray(productMedia.productId, productIds),
          isNull(productMedia.productSkuId),
          isNull(productMedia.deletedAt),
        ),
      )
      .orderBy(
        desc(productMedia.isPrimary),
        asc(productMedia.sortOrder),
        asc(productMedia.id),
      ),
  ]);
  const skuIds = skuRows.map((sku) => sku.id);
  const primaryImageByProduct = new Map<string, { id: string }>();

  for (const media of mediaRows) {
    if (!primaryImageByProduct.has(media.productId)) {
      primaryImageByProduct.set(media.productId, {
        id: media.id,
      });
    }
  }

  const [branchRows, priceRows, stockRows, lowStockSkuIds] = await Promise.all([
    input.allowedBranchIds?.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: branches.id })
          .from(branches)
          .where(
            and(
              eq(branches.tenantId, input.tenantId),
              eq(branches.status, "active"),
              isNull(branches.deletedAt),
              ...(input.allowedBranchIds
                ? [inArray(branches.id, input.allowedBranchIds)]
                : []),
            ),
          ),
    skuIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            productSkuId: productPrices.productSkuId,
            branchId: productPrices.branchId,
            amount: productPrices.amount,
            currency: productPrices.currency,
          })
          .from(productPrices)
          .where(
            and(
              eq(productPrices.tenantId, input.tenantId),
              inArray(productPrices.productSkuId, skuIds),
              eq(productPrices.status, "active"),
              isNull(productPrices.deletedAt),
              ...(input.allowedBranchIds
                ? [
                    input.allowedBranchIds.length === 0
                      ? isNull(productPrices.branchId)
                      : or(
                          isNull(productPrices.branchId),
                          inArray(
                            productPrices.branchId,
                            input.allowedBranchIds,
                          ),
                        )!,
                  ]
                : []),
            ),
          ),
    skuIds.length === 0 || input.allowedBranchIds?.length === 0
      ? Promise.resolve([])
      : db
          .select({
            productSkuId: inventoryBalances.productSkuId,
            onHandQuantity: sql<string>`coalesce(sum(${inventoryBalances.onHandQuantity}), 0)::text`,
            reservedQuantity: sql<string>`coalesce(sum(${inventoryBalances.reservedQuantity}), 0)::text`,
          })
          .from(inventoryBalances)
          .where(
            and(
              eq(inventoryBalances.tenantId, input.tenantId),
              inArray(inventoryBalances.productSkuId, skuIds),
              ...(input.allowedBranchIds
                ? [inArray(inventoryBalances.branchId, input.allowedBranchIds)]
                : []),
            ),
          )
          .groupBy(inventoryBalances.productSkuId),
    findLowStockSkuIds(db, {
      tenantId: input.tenantId,
      allowedBranchIds: input.allowedBranchIds,
      productIds,
    }),
  ]);

  const skusByProduct = new Map<string, ProductSkuRow[]>();
  const productIdBySkuId = new Map<string, string>();

  for (const sku of skuRows) {
    productIdBySkuId.set(sku.id, sku.productId);
    const productSkusForProduct = skusByProduct.get(sku.productId) ?? [];
    productSkusForProduct.push(sku);
    skusByProduct.set(sku.productId, productSkusForProduct);
  }

  const pricesByProduct = new Map<
    string,
    Array<{ amount: string; currency: string }>
  >();
  const pricesBySku = new Map<string, ProductPriceRow[]>();

  for (const price of priceRows) {
    const skuPrices = pricesBySku.get(price.productSkuId) ?? [];
    skuPrices.push(price);
    pricesBySku.set(price.productSkuId, skuPrices);
  }

  const effectiveBranchIds = branchRows.map((branch) => branch.id);

  for (const sku of skuRows) {
    const productId = productIdBySkuId.get(sku.id);

    if (!productId) {
      continue;
    }

    const productPricesForProduct = pricesByProduct.get(productId) ?? [];
    productPricesForProduct.push(
      ...resolveEffectiveSkuPrices(
        pricesBySku.get(sku.id) ?? [],
        effectiveBranchIds,
      ),
    );
    pricesByProduct.set(productId, productPricesForProduct);
  }

  const stockBySku = new Map(
    stockRows.map((row) => [
      row.productSkuId,
      {
        onHandQuantity: row.onHandQuantity,
        reservedQuantity: row.reservedQuantity,
      },
    ]),
  );

  const data: TenantProductSummary[] = productRows.map((product) => {
    const skus = orderProductSkus(skusByProduct.get(product.id) ?? []);
    const primarySku = skus[0] ?? null;

    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      tags: product.tags,
      status: product.status,
      skuCount: skus.length,
      activeSkuCount: skus.filter((sku) => sku.status === "active").length,
      trackedSkuCount: skus.filter((sku) => sku.trackInventory).length,
      primarySkuCode: primarySku?.skuCode ?? null,
      primaryBarcode: primarySku?.barcode ?? null,
      skuCodes: skus.map((sku) => sku.skuCode),
      barcodes: skus
        .map((sku) => sku.barcode)
        .filter((barcode): barcode is string => barcode !== null),
      priceRanges: buildPriceRanges(pricesByProduct.get(product.id) ?? []),
      onHandQuantity: sumQuantities(
        skus.map((sku) => stockBySku.get(sku.id)?.onHandQuantity ?? "0"),
      ),
      reservedQuantity: sumQuantities(
        skus.map((sku) => stockBySku.get(sku.id)?.reservedQuantity ?? "0"),
      ),
      lowStockSkuCount: skus.filter((sku) => lowStockSkuIds.has(sku.id)).length,
      primaryImage: primaryImageByProduct.get(product.id) ?? null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      version: product.version,
    };
  });

  return { data, total };
}

export async function findTenantProductOverview(
  db: Database,
  input: TenantProductOverviewQuery & TenantProductRepositoryScope,
): Promise<TenantProductOverview> {
  const productFilters = buildProductFilters(input);
  const skuBranchScopeFilter = buildSkuBranchScopeFilter(
    input.allowedBranchIds,
  );
  const [countRows, lowStockSkuIds] = await Promise.all([
    db
      .select({
        productCount: sql<number>`count(distinct ${products.id})::int`,
        activeProductCount: sql<number>`count(distinct ${products.id}) filter (where ${products.status} = 'active')::int`,
        skuCount: sql<number>`count(distinct ${productSkus.id})::int`,
      })
      .from(products)
      .leftJoin(
        productSkus,
        and(
          eq(productSkus.tenantId, products.tenantId),
          eq(productSkus.productId, products.id),
          isNull(productSkus.deletedAt),
          ...(skuBranchScopeFilter ? [skuBranchScopeFilter] : []),
        ),
      )
      .where(and(...productFilters)),
    findLowStockSkuIds(db, input),
  ]);
  const counts = countRows[0];

  return {
    productCount: counts?.productCount ?? 0,
    activeProductCount: counts?.activeProductCount ?? 0,
    skuCount: counts?.skuCount ?? 0,
    lowStockSkuCount: lowStockSkuIds.size,
  };
}
