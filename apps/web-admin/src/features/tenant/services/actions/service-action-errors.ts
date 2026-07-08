import { ApiHttpError } from "@cleanhub/api-client";

import type { ServiceFormValues } from "../types";

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
  errors: Partial<Record<keyof ServiceFormValues, string>>;
};

type ServiceFieldName = keyof ServiceFormValues;

const serviceFormFields = new Set<ServiceFieldName>([
  "businessLine",
  "name",
  "categoryId",
  "pricingUnit",
  "status",
  "version",
]);

const serviceFieldMap: Record<string, ServiceFieldName> = {
  businessLine: "businessLine",
  name: "name",
  categoryId: "categoryId",
  pricingUnit: "pricingUnit",
  status: "status",
  version: "version",
};

function mapValidationErrors(
  error: ApiHttpError,
): Partial<Record<ServiceFieldName, string>> {
  const errors: Partial<Record<ServiceFieldName, string>> = {};

  for (const item of error.validationErrors ?? []) {
    if (typeof item.field !== "string" || typeof item.message !== "string") {
      continue;
    }

    const field = serviceFieldMap[item.field] ?? (item.field as ServiceFieldName);

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
