import type {
  CreatePriceBookRequest,
  UpdatePriceBookRequest,
} from "@cleanhub/api-client";

import type {
  PriceBookFormValues,
  PriceBookStatus,
  PriceBusinessLine,
} from "../types";

const businessLines: PriceBusinessLine[] = [
  "laundry",
  "dry_cleaning",
  "pressing",
  "car_wash",
  "retail_products",
];
const statuses: PriceBookStatus[] = ["active", "disabled", "draft"];

export type PriceBookFormValidationResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof PriceBookFormValues, string>>;
    };

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function validateBase(input: PriceBookFormValues) {
  const errors: Partial<Record<keyof PriceBookFormValues, string>> = {};
  const name = input.name.trim();
  const currency = input.currency.trim().toUpperCase();
  const sortOrder = Number(input.sortOrder);
  const effectiveFrom = normalizeOptional(input.effectiveFrom);
  const effectiveTo = normalizeOptional(input.effectiveTo);

  if (!businessLines.includes(input.businessLine)) {
    errors.businessLine = "Choose a supported business line.";
  }

  if (!name) {
    errors.name = "Price book name is required.";
  } else if (name.length > 120) {
    errors.name = "Price book name must be 120 characters or fewer.";
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    errors.currency = "Currency must be a 3-letter code.";
  }

  if (!statuses.includes(input.status)) {
    errors.status = "Choose a supported status.";
  }

  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
    errors.sortOrder = "Sort order must be a number from 0 to 9999.";
  }

  if (effectiveFrom && Number.isNaN(Date.parse(effectiveFrom))) {
    errors.effectiveFrom = "Enter a valid start date.";
  }

  if (effectiveTo && Number.isNaN(Date.parse(effectiveTo))) {
    errors.effectiveTo = "Enter a valid end date.";
  }

  if (
    effectiveFrom &&
    effectiveTo &&
    Date.parse(effectiveFrom) > Date.parse(effectiveTo)
  ) {
    errors.effectiveTo = "End date must be after start date.";
  }

  return {
    errors,
    data: {
      businessLine: input.businessLine,
      name,
      currency,
      status: input.status,
      branchId: normalizeOptional(input.branchId),
      effectiveFrom,
      effectiveTo,
      sortOrder,
    },
  };
}

export function validatePriceBookForm(
  input: PriceBookFormValues,
): PriceBookFormValidationResult<CreatePriceBookRequest> {
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

export function validatePriceBookUpdateForm(
  input: PriceBookFormValues,
): PriceBookFormValidationResult<UpdatePriceBookRequest> {
  return validatePriceBookForm(input);
}
