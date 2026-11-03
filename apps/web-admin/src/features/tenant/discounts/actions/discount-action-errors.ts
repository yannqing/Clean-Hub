import { ApiHttpError } from "@cleanhub/api-client";

import type {
  DiscountFormErrors,
  DiscountFormField,
  DiscountFormValues,
} from "../types";

export type DiscountActionError = {
  message: string;
  code?: string;
  status?: number;
  errors: DiscountFormErrors;
};

const FORM_FIELDS = new Set<DiscountFormField>([
  "title",
  "method",
  "code",
  "type",
  "enabled",
  "valueType",
  "valueAmount",
  "currency",
  "targetScope",
  "targets",
  "eligibility",
  "customerIds",
  "minimumRequirement",
  "minimumPurchaseAmount",
  "minimumQuantity",
  "usageLimit",
  "oncePerCustomer",
  "combinesWithItemDiscounts",
  "combinesWithOrderDiscounts",
  "combinesWithShippingDiscounts",
  "startsAt",
  "hasEndDate",
  "endsAt",
  "allBranches",
  "branchIds",
  "posEnabled",
  "customerMobileEnabled",
  "deliveryEnabled",
  "buyRequirementType",
  "buyRequirementValue",
  "getQuantity",
  "maxUsesPerOrder",
  "countryScope",
  "countryCodesInput",
  "maximumShippingPrice",
  "tagsInput",
]);

const FIELD_ALIASES: Record<string, keyof DiscountFormValues> = {
  countryCodes: "countryCodesInput",
  tags: "tagsInput",
  channels: "posEnabled",
};

function mapValidationErrors(error: ApiHttpError): DiscountFormErrors {
  const errors: DiscountFormErrors = {};

  for (const item of error.validationErrors ?? []) {
    if (typeof item.field !== "string") continue;

    const root = item.field.split(".")[0];
    const field = FIELD_ALIASES[root] ?? (root as keyof DiscountFormValues);

    if (FORM_FIELDS.has(field)) errors[field] = "serverInvalid";
  }

  if (error.code?.includes("CODE") && error.code?.includes("DUPLICATE")) {
    errors.code = "serverInvalid";
  }

  return errors;
}

export function getDiscountActionError(
  error: unknown,
  fallbackMessage: string,
): DiscountActionError {
  if (error instanceof ApiHttpError) {
    return {
      message: error.message || fallbackMessage,
      code: error.code,
      status: error.status,
      errors: mapValidationErrors(error),
    };
  }

  return {
    message: error instanceof Error ? error.message : fallbackMessage,
    errors: {},
  };
}
