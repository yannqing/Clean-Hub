import type { CreateServiceRequest, UpdateServiceRequest } from "@cleanhub/api-client";

import type {
  ServiceBusinessLine,
  ServiceFormValues,
  ServicePricingMode,
  ServiceStatus,
} from "../types";

const businessLines: ServiceBusinessLine[] = [
  "laundry",
  "dry_cleaning",
  "pressing",
  "car_wash",
  "retail_products",
];
const pricingModes: ServicePricingMode[] = ["per_item", "per_kg"];
const statuses: ServiceStatus[] = ["active", "disabled"];

export type ServiceFormValidationResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof ServiceFormValues, string>>;
    };

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function validateBase(input: ServiceFormValues) {
  const errors: Partial<Record<keyof ServiceFormValues, string>> = {};
  const name = input.name.trim();
  const sortOrder = Number(input.sortOrder);

  if (!businessLines.includes(input.businessLine)) {
    errors.businessLine = "Choose a supported business line.";
  }

  if (!name) {
    errors.name = "Service name is required.";
  } else if (name.length > 120) {
    errors.name = "Service name must be 120 characters or fewer.";
  }

  if (input.category.trim().length > 80) {
    errors.category = "Category must be 80 characters or fewer.";
  }

  if (input.description.trim().length > 500) {
    errors.description = "Description must be 500 characters or fewer.";
  }

  if (!pricingModes.includes(input.pricingMode)) {
    errors.pricingMode = "Choose a supported pricing mode.";
  }

  if (!statuses.includes(input.status)) {
    errors.status = "Choose a supported status.";
  }

  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
    errors.sortOrder = "Sort order must be a number from 0 to 9999.";
  }

  return {
    errors,
    data: {
      businessLine: input.businessLine,
      name,
      category: normalizeOptional(input.category),
      description: normalizeOptional(input.description),
      pricingMode: input.pricingMode,
      status: input.status,
      sortOrder,
    },
  };
}

export function validateServiceForm(
  input: ServiceFormValues,
): ServiceFormValidationResult<CreateServiceRequest> {
  const result = validateBase(input);

  if (Object.keys(result.errors).length > 0) {
    return {
      ok: false,
      errors: result.errors,
    };
  }

  return {
    ok: true,
    data: result.data,
  };
}

export function validateServiceUpdateForm(
  input: ServiceFormValues,
): ServiceFormValidationResult<UpdateServiceRequest> {
  return validateServiceForm(input);
}
