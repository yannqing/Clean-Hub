import type {
  CreateServiceRequest,
  UpdateServiceRequest,
} from "@cleanhub/api-client";

import type {
  ServiceBusinessLine,
  ServiceFormErrors,
  ServiceFormValues,
  ServiceLabelRule,
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
const labelRules: ServiceLabelRule[] = [
  "none",
  "per_item",
  "per_order_item",
  "per_bag",
];
const statuses: ServiceStatus[] = ["active", "inactive"];
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const STANDARD_PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

export type ServiceFormValidationResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      errors: ServiceFormErrors;
    };

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function validateBase(input: ServiceFormValues) {
  const errors: ServiceFormErrors = {};
  const name = input.name.trim();
  const categoryId = input.categoryId.trim();
  const description = input.description.trim();
  const displayOrder = Number(input.displayOrder);

  if (!businessLines.includes(input.businessLine)) {
    errors.businessLine = "businessLineInvalid";
  }

  if (!name) {
    errors.name = "nameRequired";
  } else if (name.length > 200) {
    errors.name = "nameTooLong";
  }

  if (!categoryId) {
    errors.categoryId = "categoryRequired";
  } else if (!ULID_PATTERN.test(categoryId)) {
    errors.categoryId = "categoryInvalid";
  }

  if (description.length > 2000) {
    errors.description = "descriptionTooLong";
  }

  if (
    !/^\d+$/.test(input.displayOrder.trim()) ||
    !Number.isInteger(displayOrder) ||
    displayOrder < 0 ||
    displayOrder > 1_000_000
  ) {
    errors.displayOrder = "displayOrderInvalid";
  }

  if (!pricingUnits.includes(input.pricingUnit)) {
    errors.pricingUnit = "pricingUnitInvalid";
  }

  if (!labelRules.includes(input.labelRule)) {
    errors.labelRule = "labelRuleInvalid";
  }

  if (!statuses.includes(input.status)) {
    errors.status = "statusInvalid";
  }

  return {
    errors,
    data: {
      businessLine: input.businessLine,
      name,
      categoryId,
      description: normalizeOptional(input.description),
      displayOrder,
      pricingUnit: input.pricingUnit,
      labelRule: input.labelRule,
      status: input.status,
    },
  };
}

export function validateServiceForm(
  input: ServiceFormValues,
): ServiceFormValidationResult<CreateServiceRequest> {
  const result = validateBase(input);
  const standardPrice = input.standardPrice.trim();

  if (
    !STANDARD_PRICE_PATTERN.test(standardPrice) ||
    Number(standardPrice) <= 0 ||
    Number(standardPrice) > 9_999_999_999.99
  ) {
    result.errors.standardPrice = "standardPriceInvalid";
  }

  if (Object.keys(result.errors).length > 0) {
    return {
      ok: false,
      errors: result.errors,
    };
  }

  return {
    ok: true,
    data: {
      ...result.data,
      standardPrice,
    },
  };
}

export function validateServiceUpdateForm(
  input: ServiceFormValues,
): ServiceFormValidationResult<UpdateServiceRequest> {
  const result = validateBase(input);
  const errors = { ...result.errors };
  const standardPrice = input.standardPrice.trim();
  const currency = input.currency.trim().toUpperCase();

  if (
    !STANDARD_PRICE_PATTERN.test(standardPrice) ||
    Number(standardPrice) <= 0 ||
    Number(standardPrice) > 9_999_999_999.99
  ) {
    errors.standardPrice = "standardPriceInvalid";
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    errors.currency = "currencyInvalid";
  }

  if (!Number.isInteger(input.version) || input.version < 1) {
    errors.version = "versionRequired";
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
      standardPrice,
      currency,
      version: input.version,
    },
  };
}
