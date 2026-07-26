import { ApiHttpError } from "@cleanhub/api-client";

import type { ProductFormErrors, ProductFormValues } from "../types";

export type ProductActionError = {
  message: string;
  code?: string;
  status?: number;
  errors: ProductFormErrors;
};

const PRODUCT_FORM_FIELDS = new Set<keyof ProductFormValues>([
  "name",
  "categoryId",
  "categoryAttributes",
  "brand",
  "description",
  "tags",
  "mediaObjectKeys",
  "status",
  "skuCode",
  "barcode",
  "variantName",
  "unitOfMeasure",
  "unitsPerSale",
  "salePrice",
  "currency",
  "referenceCost",
  "trackInventory",
  "allowNegativeStock",
  "allowOfflineSale",
  "branchSettings",
]);

function mapValidationErrors(error: ApiHttpError): ProductFormErrors {
  const errors: ProductFormErrors = {};

  for (const item of error.validationErrors ?? []) {
    const field = item.field.split(".")[0] as keyof ProductFormValues;

    if (PRODUCT_FORM_FIELDS.has(field)) {
      errors[field] = "serverInvalid";
    }
  }

  return errors;
}

export function getProductActionError(
  error: unknown,
  fallbackMessage: string,
): ProductActionError {
  if (error instanceof ApiHttpError) {
    const errors = mapValidationErrors(error);

    if (error.code === "PRODUCT_SKU_CODE_DUPLICATE") {
      errors.skuCode = "skuCodeDuplicate";
    }

    if (error.code === "PRODUCT_BARCODE_DUPLICATE") {
      errors.barcode = "barcodeDuplicate";
    }

    if (error.code?.startsWith("PRODUCT_MEDIA_")) {
      errors.mediaObjectKeys = "mediaInvalid";
    }

    if (error.code === "PRODUCT_CATEGORY_ATTRIBUTE_INVALID") {
      errors.categoryAttributes = "categoryAttributesInvalid";
    }

    if (error.code === "PRODUCT_CATEGORY_ATTRIBUTE_REQUIRED") {
      errors.categoryAttributes = "categoryAttributeValueRequired";
    }

    if (
      error.code === "PRODUCT_CATEGORY_NOT_FOUND" ||
      error.code === "PRODUCT_CATEGORY_INACTIVE"
    ) {
      errors.categoryId = "categoryInvalid";
    }

    return {
      message: error.message || fallbackMessage,
      code: error.code,
      status: error.status,
      errors,
    };
  }

  return {
    message: error instanceof Error ? error.message : fallbackMessage,
    errors: {},
  };
}
