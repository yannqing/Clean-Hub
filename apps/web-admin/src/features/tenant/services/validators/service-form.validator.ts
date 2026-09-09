import type {
  CreateServiceRequest,
  UpdateServiceRequest,
} from "@cleanhub/api-client";

import type {
  ServiceBusinessLine,
  ServiceApplicableItemType,
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
const applicableItemTypes: ServiceApplicableItemType[] = [
  "cloth",
  "car",
  "shoe",
  "carpet",
];
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const STANDARD_PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;
const SERVICE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const MAX_SERVICE_IMAGES = 10;

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
  const code = input.code.trim().toUpperCase();
  const shortName = input.shortName.trim();
  const categoryId = input.categoryId.trim();
  const description = input.description.trim();
  const internalNotes = input.internalNotes.trim();
  const turnaroundMinutesValue = input.turnaroundMinutes.trim();
  const turnaroundMinutes = Number(turnaroundMinutesValue);
  const displayOrder = Number(input.displayOrder);
  const selectedBranchSettings = input.allBranches
    ? []
    : input.branchSettings.filter((setting) => setting.isAvailable);

  if (!businessLines.includes(input.businessLine)) {
    errors.businessLine = "businessLineInvalid";
  }

  if (!name) {
    errors.name = "nameRequired";
  } else if (name.length > 200) {
    errors.name = "nameTooLong";
  }

  if (code && !SERVICE_CODE_PATTERN.test(code)) {
    errors.code = "codeInvalid";
  }

  if (shortName.length > 80) {
    errors.shortName = "shortNameTooLong";
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
    input.mediaObjectKeys.length > MAX_SERVICE_IMAGES ||
    new Set(input.mediaObjectKeys).size !== input.mediaObjectKeys.length ||
    input.mediaObjectKeys.some((key) => !key.trim())
  ) {
    errors.mediaObjectKeys = "mediaInvalid";
  }

  if (internalNotes.length > 5000) {
    errors.internalNotes = "internalNotesTooLong";
  }

  if (
    turnaroundMinutesValue &&
    (!/^\d+$/.test(turnaroundMinutesValue) ||
      !Number.isInteger(turnaroundMinutes) ||
      turnaroundMinutes < 1 ||
      turnaroundMinutes > 525_600)
  ) {
    errors.turnaroundMinutes = "turnaroundMinutesInvalid";
  }

  if (!input.allBranches && selectedBranchSettings.length === 0) {
    errors.branchSettings = "branchRequired";
  }
  if (
    selectedBranchSettings.some((setting) => {
      const price = setting.priceOverrideAmount.trim();
      const turnaround = setting.turnaroundMinutesOverride.trim();
      return (
        !ULID_PATTERN.test(setting.branchId) ||
        (price !== "" &&
          (!STANDARD_PRICE_PATTERN.test(price) ||
            Number(price) <= 0 ||
            Number(price) > 9_999_999_999.99)) ||
        (turnaround !== "" &&
          (!/^\d+$/.test(turnaround) ||
            Number(turnaround) < 1 ||
            Number(turnaround) > 525_600))
      );
    })
  ) {
    errors.branchSettings = "branchSettingsInvalid";
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

  if (input.applicableItemTypes.length === 0) {
    errors.applicableItemTypes = "applicableItemTypesRequired";
  } else if (
    new Set(input.applicableItemTypes).size !==
      input.applicableItemTypes.length ||
    input.applicableItemTypes.some(
      (itemType) => !applicableItemTypes.includes(itemType),
    ) ||
    (input.businessLine === "car_wash" &&
      input.applicableItemTypes.some((itemType) => itemType !== "car")) ||
    (input.businessLine === "laundry" &&
      input.applicableItemTypes.includes("car"))
  ) {
    errors.applicableItemTypes = "applicableItemTypesInvalid";
  }

  if (!statuses.includes(input.status)) {
    errors.status = "statusInvalid";
  }

  return {
    errors,
    data: {
      businessLine: input.businessLine,
      name,
      code: code || null,
      shortName: shortName || null,
      categoryId,
      description: normalizeOptional(input.description),
      mediaObjectKeys: input.mediaObjectKeys,
      internalNotes: normalizeOptional(input.internalNotes),
      turnaroundMinutes: turnaroundMinutesValue ? turnaroundMinutes : null,
      allBranches: input.allBranches,
      branchSettings: selectedBranchSettings.map((setting) => ({
        branchId: setting.branchId,
        isAvailable: true,
        priceOverrideAmount:
          normalizeOptional(setting.priceOverrideAmount) ?? null,
        turnaroundMinutesOverride: setting.turnaroundMinutesOverride.trim()
          ? Number(setting.turnaroundMinutesOverride)
          : null,
      })),
      displayOrder,
      pricingUnit: input.pricingUnit,
      labelRule: input.labelRule,
      applicableItemTypes: input.applicableItemTypes,
      status: input.status,
    },
  };
}

export function validateServiceForm(
  input: ServiceFormValues,
): ServiceFormValidationResult<CreateServiceRequest> {
  const result = validateBase(input);
  const standardPrice = input.standardPrice.trim();
  const compareAtPrice = input.compareAtPrice.trim();
  const costPrice = input.costPrice.trim();

  if (
    !STANDARD_PRICE_PATTERN.test(standardPrice) ||
    Number(standardPrice) <= 0 ||
    Number(standardPrice) > 9_999_999_999.99
  ) {
    result.errors.standardPrice = "standardPriceInvalid";
  }

  if (
    compareAtPrice &&
    (!STANDARD_PRICE_PATTERN.test(compareAtPrice) ||
      Number(compareAtPrice) <= Number(standardPrice) ||
      Number(compareAtPrice) > 9_999_999_999.99)
  ) {
    result.errors.compareAtPrice = "compareAtPriceInvalid";
  }

  if (
    costPrice &&
    (!STANDARD_PRICE_PATTERN.test(costPrice) ||
      Number(costPrice) <= 0 ||
      Number(costPrice) > 9_999_999_999.99)
  ) {
    result.errors.costPrice = "costPriceInvalid";
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
      compareAtPrice: compareAtPrice || null,
      costPrice: costPrice || null,
      mediaObjectKeys: result.data.mediaObjectKeys,
    },
  };
}

export function validateServiceUpdateForm(
  input: ServiceFormValues,
): ServiceFormValidationResult<UpdateServiceRequest> {
  const result = validateBase(input);
  const errors = { ...result.errors };
  const standardPrice = input.standardPrice.trim();
  const compareAtPrice = input.compareAtPrice.trim();
  const costPrice = input.costPrice.trim();

  if (
    !STANDARD_PRICE_PATTERN.test(standardPrice) ||
    Number(standardPrice) <= 0 ||
    Number(standardPrice) > 9_999_999_999.99
  ) {
    errors.standardPrice = "standardPriceInvalid";
  }

  if (
    compareAtPrice &&
    (!STANDARD_PRICE_PATTERN.test(compareAtPrice) ||
      Number(compareAtPrice) <= Number(standardPrice) ||
      Number(compareAtPrice) > 9_999_999_999.99)
  ) {
    errors.compareAtPrice = "compareAtPriceInvalid";
  }

  if (
    costPrice &&
    (!STANDARD_PRICE_PATTERN.test(costPrice) ||
      Number(costPrice) <= 0 ||
      Number(costPrice) > 9_999_999_999.99)
  ) {
    errors.costPrice = "costPriceInvalid";
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
      compareAtPrice: compareAtPrice || null,
      costPrice: costPrice || null,
      newMediaObjectKeys: result.data.mediaObjectKeys,
      version: input.version,
    },
  };
}
