import { ApiHttpError } from "@cleanhub/api-client";

import type { PriceFormValues } from "../types";

/**
 * Map an API error thrown by a price write into the action result shape used
 * by the price catalog view. Mirrors the service/branch action error pattern:
 * surface the HTTP status / error code (so the view can detect version
 * conflicts) and lift field-level validation errors onto the matching form
 * field.
 */
export type PriceActionError = {
  message: string;
  code?: string;
  status?: number;
  errors: Partial<Record<keyof PriceFormValues, string>>;
};

type PriceFieldName = keyof PriceFormValues;

const priceFormFields = new Set<PriceFieldName>([
  "amount",
  "currency",
  "status",
  "version",
]);

const priceFieldMap: Record<string, PriceFieldName> = {
  amount: "amount",
  currency: "currency",
  status: "status",
  version: "version",
};

function mapValidationErrors(
  error: ApiHttpError,
): Partial<Record<PriceFieldName, string>> {
  const errors: Partial<Record<PriceFieldName, string>> = {};

  for (const item of error.validationErrors ?? []) {
    if (typeof item.field !== "string" || typeof item.message !== "string") {
      continue;
    }

    const field = priceFieldMap[item.field] ?? (item.field as PriceFieldName);

    if (priceFormFields.has(field)) {
      errors[field] = item.message;
    }
  }

  return errors;
}

export function getPriceActionError(
  error: unknown,
  fallbackMessage: string,
): PriceActionError {
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
