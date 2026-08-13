import { ApiHttpError } from "@cleanhub/api-client";

import type { ServiceFormErrors, ServiceFormValues } from "../types";

/**
 * Map an API error thrown by a service write into the action result shape used
 * by the catalog view. Mirrors the branch action error pattern: surface the
 * HTTP status / error code (so the view can detect version conflicts) and lift
 * field-level validation errors onto the matching form field.
 */
export type ServiceActionError = {
  message: string;
  code?: string;
  status?: number;
  errors: ServiceFormErrors;
};

type ServiceFieldName = keyof ServiceFormValues;

const serviceFormFields = new Set<ServiceFieldName>([
  "businessLine",
  "name",
  "code",
  "shortName",
  "categoryId",
  "description",
  "mediaObjectKeys",
  "internalNotes",
  "turnaroundMinutes",
  "allBranches",
  "branchSettings",
  "displayOrder",
  "pricingUnit",
  "labelRule",
  "standardPrice",
  "compareAtPrice",
  "costPrice",
  "currency",
  "status",
  "version",
]);

const serviceFieldMap: Record<string, ServiceFieldName> = {
  businessLine: "businessLine",
  name: "name",
  code: "code",
  shortName: "shortName",
  categoryId: "categoryId",
  description: "description",
  mediaObjectKeys: "mediaObjectKeys",
  newMediaObjectKeys: "mediaObjectKeys",
  internalNotes: "internalNotes",
  turnaroundMinutes: "turnaroundMinutes",
  allBranches: "allBranches",
  branchSettings: "branchSettings",
  displayOrder: "displayOrder",
  pricingUnit: "pricingUnit",
  labelRule: "labelRule",
  standardPrice: "standardPrice",
  compareAtPrice: "compareAtPrice",
  costPrice: "costPrice",
  currency: "currency",
  status: "status",
  version: "version",
};

function mapValidationErrors(error: ApiHttpError): ServiceFormErrors {
  const errors: ServiceFormErrors = {};

  for (const item of error.validationErrors ?? []) {
    if (typeof item.field !== "string" || typeof item.message !== "string") {
      continue;
    }

    const field =
      serviceFieldMap[item.field] ?? (item.field as ServiceFieldName);

    if (serviceFormFields.has(field)) {
      errors[field] = item.message;
    }
  }

  return errors;
}

export function getServiceActionError(
  error: unknown,
  fallbackMessage: string,
): ServiceActionError {
  if (error instanceof ApiHttpError) {
    const errors = mapValidationErrors(error);

    if (
      [
        "SERVICE_CATEGORY_NOT_FOUND",
        "SERVICE_CATEGORY_INACTIVE",
        "SERVICE_CATEGORY_BUSINESS_LINE_MISMATCH",
      ].includes(error.code ?? "")
    ) {
      errors.categoryId = "categoryInvalid";
    }

    if (error.code === "SERVICE_CODE_DUPLICATE") {
      errors.code = "codeDuplicate";
    }

    if (error.code === "SERVICE_COMPARE_AT_PRICE_INVALID") {
      errors.compareAtPrice = "compareAtPriceInvalid";
    }
    if (error.code === "SERVICE_BRANCH_REQUIRED") {
      errors.branchSettings = "branchRequired";
    }
    if (
      error.code === "SERVICE_BRANCH_NOT_FOUND" ||
      error.code === "SERVICE_BRANCH_INACTIVE"
    ) {
      errors.branchSettings = "branchSettingsInvalid";
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
