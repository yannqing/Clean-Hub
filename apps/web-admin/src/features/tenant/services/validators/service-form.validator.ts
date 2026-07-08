import type { CreateServiceRequest, UpdateServiceRequest } from "@cleanhub/api-client";

import type {
  ServiceBusinessLine,
  ServiceFormValues,
  ServicePricingUnit,
  ServiceStatus,
} from "../types";

const businessLines: ServiceBusinessLine[] = [
  "laundry",
  "car_wash",
  "retail",
  "delivery",
];
const pricingUnits: ServicePricingUnit[] = ["per_item", "per_kg"];
const statuses: ServiceStatus[] = ["active", "inactive"];

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

  if (!businessLines.includes(input.businessLine)) {
    errors.businessLine = "Choose a supported business line.";
  }

  if (!name) {
    errors.name = "Service name is required.";
  } else if (name.length > 120) {
    errors.name = "Service name must be 120 characters or fewer.";
  }

  if (!pricingUnits.includes(input.pricingUnit)) {
    errors.pricingUnit = "Choose a supported pricing unit.";
  }

  if (!statuses.includes(input.status)) {
    errors.status = "Choose a supported status.";
  }

  return {
    errors,
    data: {
      businessLine: input.businessLine,
      name,
      categoryId: normalizeOptional(input.categoryId),
      pricingUnit: input.pricingUnit,
      status: input.status,
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
  const result = validateBase(input);
  const errors = { ...result.errors };

  if (!Number.isInteger(input.version) || input.version < 1) {
    errors.version = "Service version is required. Refresh and try again.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    data: {
      ...result.data,
      version: input.version,
    },
  };
}
