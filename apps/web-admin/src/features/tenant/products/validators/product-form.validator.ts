import type { CreateTenantProductRequest } from "@cleanhub/api-client";

import type { ProductFormErrors, ProductFormValues } from "../types";

const MAX_CATEGORY_ATTRIBUTES = 30;
const PRODUCT_STATUSES = new Set(["active", "inactive"]);
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const WHOLE_QUANTITY_PATTERN = /^(?:0|[1-9]\d{0,10})(?:\.0{1,3})?$/;
const SIGNED_WHOLE_QUANTITY_PATTERN = /^-?(?:0|[1-9]\d{0,10})(?:\.0{1,3})?$/;
const DECIMAL_12_2_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

export type ProductFormValidationResult =
  | {
      ok: true;
      data: CreateTenantProductRequest & { currency: string };
    }
  | {
      ok: false;
      errors: ProductFormErrors;
      invalidCategoryAttributeDefinitionIds: string[];
    };

function normalizeOptional(value: string): string | undefined {
  const normalized = value.trim();

  return normalized || undefined;
}

function isNonNegativeDecimal(value: string, pattern: RegExp): boolean {
  return pattern.test(value);
}

function isPositiveDecimal(value: string, pattern: RegExp): boolean {
  return pattern.test(value) && Number(value) > 0;
}

export function splitProductTagInput(value: string): string[] {
  return value.split(/[,，]/);
}

export function normalizeProductTags(values: string[]): string[] {
  const normalizedTags: string[] = [];
  const seenTags = new Set<string>();

  for (const value of values) {
    const tag = value.trim();

    if (!tag) {
      continue;
    }

    const normalizedTag = tag.toLowerCase();

    if (seenTags.has(normalizedTag)) {
      continue;
    }

    seenTags.add(normalizedTag);
    normalizedTags.push(tag);
  }

  return normalizedTags;
}

export function validateProductForm(
  input: ProductFormValues,
  mode: "create" | "edit" = "create",
): ProductFormValidationResult {
  const errors: ProductFormErrors = {};
  const invalidCategoryAttributeDefinitionIds = new Set<string>();
  const name = input.name.trim();
  const categoryId = normalizeOptional(input.categoryId);
  const categoryAttributes = input.categoryAttributes.map((attribute) =>
    typeof attribute.textValue === "string"
      ? {
          definitionId: attribute.definitionId.trim(),
          textValue: attribute.textValue.trim(),
        }
      : {
          definitionId: attribute.definitionId.trim(),
          optionIds: attribute.optionIds.map((optionId) => optionId.trim()),
        },
  );
  const brand = normalizeOptional(input.brand);
  const description = normalizeOptional(input.description);
  const tags = normalizeProductTags(input.tags);
  const mediaObjectKeys = input.mediaObjectKeys.map((key) => key.trim());
  const skuCode = input.skuCode.trim();
  const barcode = normalizeOptional(input.barcode);
  const variantName = normalizeOptional(input.variantName);
  const unitOfMeasure = input.unitOfMeasure.trim();
  const unitsPerSale = input.unitsPerSale.trim();
  const salePrice = input.salePrice.trim();
  const currency = input.currency.trim().toUpperCase();
  const referenceCost = input.referenceCost.trim();
  const branchSettings = input.branchSettings.map((setting) => ({
    branchId: setting.branchId.trim(),
    openingStock: setting.openingStock.trim(),
    reorderPoint: setting.reorderPoint.trim(),
  }));

  if (!name) {
    errors.name = "nameRequired";
  } else if (name.length > 200) {
    errors.name = "nameTooLong";
  }

  if (categoryId && !ULID_PATTERN.test(categoryId)) {
    errors.categoryId = "categoryInvalid";
  }

  if (categoryAttributes.length > MAX_CATEGORY_ATTRIBUTES) {
    errors.categoryAttributes = "tooManyCategoryAttributes";
  } else {
    const seenDefinitionIds = new Set<string>();
    let hasInvalidAttribute = false;
    let hasMissingValue = false;

    for (const attribute of categoryAttributes) {
      if (
        !ULID_PATTERN.test(attribute.definitionId) ||
        seenDefinitionIds.has(attribute.definitionId)
      ) {
        hasInvalidAttribute = true;
        invalidCategoryAttributeDefinitionIds.add(attribute.definitionId);
      }

      seenDefinitionIds.add(attribute.definitionId);

      if (typeof attribute.textValue === "string") {
        if (!attribute.textValue) {
          hasMissingValue = true;
          invalidCategoryAttributeDefinitionIds.add(attribute.definitionId);
        } else if (attribute.textValue.length > 1_000) {
          hasInvalidAttribute = true;
          invalidCategoryAttributeDefinitionIds.add(attribute.definitionId);
        }
        continue;
      }

      if (attribute.optionIds.length === 0) {
        hasMissingValue = true;
        invalidCategoryAttributeDefinitionIds.add(attribute.definitionId);
      } else if (
        attribute.optionIds.length > 50 ||
        attribute.optionIds.some((optionId) => !ULID_PATTERN.test(optionId)) ||
        new Set(attribute.optionIds).size !== attribute.optionIds.length
      ) {
        hasInvalidAttribute = true;
        invalidCategoryAttributeDefinitionIds.add(attribute.definitionId);
      }
    }

    if (!categoryId && categoryAttributes.length > 0) {
      hasInvalidAttribute = true;
    }

    if (hasInvalidAttribute) {
      errors.categoryAttributes = "categoryAttributesInvalid";
    } else if (hasMissingValue) {
      errors.categoryAttributes = "categoryAttributeValueRequired";
    }
  }

  if (brand && brand.length > 120) {
    errors.brand = "brandTooLong";
  }

  if (description && description.length > 5_000) {
    errors.description = "descriptionTooLong";
  }

  if (tags.length > 20) {
    errors.tags = "tooManyTags";
  } else if (tags.some((tag) => tag.length > 60)) {
    errors.tags = "tagTooLong";
  }

  if (mediaObjectKeys.length > 10) {
    errors.mediaObjectKeys = "tooManyMedia";
  } else if (
    mediaObjectKeys.some((key) => !key || key.length > 1_024) ||
    new Set(mediaObjectKeys).size !== mediaObjectKeys.length
  ) {
    errors.mediaObjectKeys = "mediaInvalid";
  }

  if (!PRODUCT_STATUSES.has(input.status)) {
    errors.status = "statusInvalid";
  }

  if (!skuCode) {
    errors.skuCode = "skuCodeRequired";
  } else if (skuCode.length > 80) {
    errors.skuCode = "skuCodeTooLong";
  }

  if (barcode && barcode.length > 80) {
    errors.barcode = "barcodeTooLong";
  }

  if (variantName && variantName.length > 160) {
    errors.variantName = "variantNameTooLong";
  }

  if (!unitOfMeasure) {
    errors.unitOfMeasure = "unitOfMeasureRequired";
  } else if (unitOfMeasure.length > 32) {
    errors.unitOfMeasure = "unitOfMeasureTooLong";
  }

  if (
    !isPositiveDecimal(unitsPerSale, WHOLE_QUANTITY_PATTERN) ||
    Number(unitsPerSale) !== 1
  ) {
    errors.unitsPerSale = "unitsPerSaleInvalid";
  }

  if (!isNonNegativeDecimal(salePrice, DECIMAL_12_2_PATTERN)) {
    errors.salePrice = "salePriceInvalid";
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    errors.currency = "currencyInvalid";
  }

  if (
    referenceCost &&
    !isNonNegativeDecimal(referenceCost, DECIMAL_12_2_PATTERN)
  ) {
    errors.referenceCost = "referenceCostInvalid";
  }

  if (branchSettings.length === 0) {
    errors.branchSettings = "branchRequired";
  } else if (
    branchSettings.some((setting) => !ULID_PATTERN.test(setting.branchId))
  ) {
    errors.branchSettings = "branchInvalid";
  } else if (
    new Set(branchSettings.map((setting) => setting.branchId)).size !==
    branchSettings.length
  ) {
    errors.branchSettings = "branchDuplicate";
  } else if (
    branchSettings.some(
      (setting) =>
        !isNonNegativeDecimal(
          setting.openingStock,
          mode === "edit"
            ? SIGNED_WHOLE_QUANTITY_PATTERN
            : WHOLE_QUANTITY_PATTERN,
        ) ||
        !isNonNegativeDecimal(setting.reorderPoint, WHOLE_QUANTITY_PATTERN) ||
        (!input.trackInventory &&
          (Number(setting.openingStock) !== 0 ||
            Number(setting.reorderPoint) !== 0)),
    )
  ) {
    errors.branchSettings = "branchInventoryInvalid";
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      invalidCategoryAttributeDefinitionIds: [
        ...invalidCategoryAttributeDefinitionIds,
      ],
    };
  }

  return {
    ok: true,
    data: {
      name,
      ...(categoryId ? { categoryId } : {}),
      categoryAttributes,
      ...(brand ? { brand } : {}),
      ...(description ? { description } : {}),
      tags,
      mediaObjectKeys,
      status: input.status as CreateTenantProductRequest["status"],
      skuCode,
      ...(barcode ? { barcode } : {}),
      ...(variantName ? { variantName } : {}),
      unitOfMeasure,
      unitsPerSale,
      salePrice,
      currency,
      referenceCost: referenceCost || null,
      trackInventory: input.trackInventory,
      allowNegativeStock: input.allowNegativeStock,
      allowOfflineSale: input.allowOfflineSale,
      branchSettings,
    },
  };
}
