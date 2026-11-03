import type { CreateTenantDiscountRequest } from "@cleanhub/api-client";

import { discountDateTimeLocalToIso } from "../date-time";
import type {
  DiscountFormErrors,
  DiscountFormValues,
  TenantDiscountTargetInput,
} from "../types";

const CODE_PATTERN = /^[A-Z0-9_-]{2,100}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 60;
const MONEY_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;
const QUANTITY_PATTERN = /^(?:0|[1-9]\d{0,10})(?:\.\d{1,3})?$/;

export type DiscountFormValidationResult =
  | { ok: true; data: CreateTenantDiscountRequest }
  | { ok: false; errors: DiscountFormErrors };

function positiveDecimal(value: string, pattern: RegExp): number | null {
  if (!pattern.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function positiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function uniqueTargets(
  targets: TenantDiscountTargetInput[],
): TenantDiscountTargetInput[] {
  const seen = new Set<string>();

  return targets.filter((target) => {
    const key = `${target.role}:${target.targetType}:${target.targetId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseDiscountTags(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const candidate of value.split(/[,，]/)) {
    const tag = candidate.trim();
    const normalized = tag.toLocaleLowerCase();

    if (!tag || seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(tag);
  }

  return tags;
}

export function parseCountryCodes(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,，\s]+/)
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

export function validateDiscountForm(
  input: DiscountFormValues,
  timeZone: string,
): DiscountFormValidationResult {
  const errors: DiscountFormErrors = {};
  const title = input.title.trim();
  const code = input.code.trim().toUpperCase();
  const currency = input.currency.trim().toUpperCase();
  const startsAt = discountDateTimeLocalToIso(input.startsAt, timeZone);
  const endsAt = input.hasEndDate
    ? discountDateTimeLocalToIso(input.endsAt, timeZone)
    : null;
  const tags = parseDiscountTags(input.tagsInput);
  const countryCodes = parseCountryCodes(input.countryCodesInput);
  const targets = uniqueTargets(input.targets);

  if (!title) errors.title = "titleRequired";
  else if (title.length > 200) errors.title = "titleTooLong";

  if (input.method === "code") {
    if (!code) errors.code = "codeRequired";
    else if (!CODE_PATTERN.test(code)) errors.code = "codeInvalid";
  }

  const valueAmount = positiveDecimal(input.valueAmount, MONEY_PATTERN);
  const needsValue =
    input.type === "amount_off_items" ||
    input.type === "amount_off_order" ||
    (input.type === "buy_x_get_y" && input.valueType !== "free");

  if (
    needsValue &&
    (valueAmount === null ||
      (input.valueType === "percentage" && valueAmount > 100))
  ) {
    errors.valueAmount = "valueInvalid";
  }

  const minimumAmount = positiveDecimal(
    input.minimumPurchaseAmount,
    MONEY_PATTERN,
  );
  const minimumQuantity = positiveDecimal(
    input.minimumQuantity,
    QUANTITY_PATTERN,
  );
  if (
    (input.minimumRequirement === "minimum_amount" && minimumAmount === null) ||
    (input.minimumRequirement === "minimum_quantity" &&
      minimumQuantity === null)
  ) {
    errors.minimumRequirement = "minimumInvalid";
  }

  const usageLimit = input.usageLimit.trim()
    ? positiveInteger(input.usageLimit)
    : null;
  if (input.usageLimit.trim() && usageLimit === null) {
    errors.usageLimit = "usageLimitInvalid";
  }

  if (
    input.eligibility === "specific_customers" &&
    input.customerIds.length === 0
  ) {
    errors.customerIds = "customersRequired";
  }

  if (
    input.type === "amount_off_items" &&
    !targets.some((target) => target.role === "applies_to")
  ) {
    errors.targets = "targetsRequired";
  }

  if (
    input.type === "buy_x_get_y" &&
    !targets.some((target) => target.role === "customer_buys")
  ) {
    errors.targets = "targetsRequired";
  }

  if (
    input.type === "buy_x_get_y" &&
    !targets.some((target) => target.role === "customer_gets")
  ) {
    errors.targets = "targetsRequired";
  }

  if (!input.allBranches && input.branchIds.length === 0) {
    errors.branchIds = "branchesRequired";
  }

  const buyRequirementValue = positiveDecimal(
    input.buyRequirementValue,
    QUANTITY_PATTERN,
  );
  const getQuantity = positiveDecimal(input.getQuantity, QUANTITY_PATTERN);
  const maxUsesPerOrder = input.maxUsesPerOrder.trim()
    ? positiveInteger(input.maxUsesPerOrder)
    : null;

  if (input.type === "buy_x_get_y" && buyRequirementValue === null) {
    errors.buyRequirementValue = "buyRequirementInvalid";
  }
  if (input.type === "buy_x_get_y" && getQuantity === null) {
    errors.getQuantity = "getQuantityInvalid";
  }
  if (
    input.type === "buy_x_get_y" &&
    input.maxUsesPerOrder.trim() &&
    maxUsesPerOrder === null
  ) {
    errors.maxUsesPerOrder = "maxUsesPerOrderInvalid";
  }

  if (
    !startsAt ||
    (input.hasEndDate &&
      (!endsAt || new Date(endsAt).getTime() <= new Date(startsAt).getTime()))
  ) {
    errors.startsAt = "datesInvalid";
    if (input.hasEndDate) errors.endsAt = "datesInvalid";
  }

  if (
    input.type === "free_shipping" &&
    input.countryScope === "selected" &&
    (countryCodes.length === 0 ||
      countryCodes.some((code) => !COUNTRY_PATTERN.test(code)))
  ) {
    errors.countryCodesInput = "countriesRequired";
  }

  const maximumShippingPrice = input.maximumShippingPrice.trim()
    ? positiveDecimal(input.maximumShippingPrice, MONEY_PATTERN)
    : null;
  if (
    input.type === "free_shipping" &&
    input.maximumShippingPrice.trim() &&
    maximumShippingPrice === null
  ) {
    errors.maximumShippingPrice = "shippingPriceInvalid";
  }

  if (
    tags.length > MAX_TAGS ||
    tags.some((tag) => tag.length > MAX_TAG_LENGTH)
  ) {
    errors.tagsInput = "tagsInvalid";
  }

  const needsCurrency =
    input.valueType === "fixed_amount" ||
    input.minimumRequirement === "minimum_amount" ||
    (input.type === "buy_x_get_y" &&
      input.buyRequirementType === "minimum_amount") ||
    (input.type === "free_shipping" &&
      input.maximumShippingPrice.trim().length > 0);

  if (needsCurrency && !CURRENCY_PATTERN.test(currency)) {
    errors.currency = "currencyRequired";
  }

  if (Object.keys(errors).length > 0 || !startsAt) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      title,
      method: input.method,
      code: input.method === "code" ? code : null,
      type: input.type,
      enabled: input.enabled,
      valueType: input.type === "free_shipping" ? "free" : input.valueType,
      valueAmount: needsValue ? input.valueAmount.trim() : null,
      currency: needsCurrency ? currency : null,
      eligibility: input.eligibility,
      minimumRequirement: input.minimumRequirement,
      minimumPurchaseAmount:
        input.minimumRequirement === "minimum_amount"
          ? input.minimumPurchaseAmount.trim()
          : null,
      minimumQuantity:
        input.minimumRequirement === "minimum_quantity"
          ? input.minimumQuantity.trim()
          : null,
      usageLimit,
      oncePerCustomer: input.oncePerCustomer,
      combinesWithItemDiscounts: input.combinesWithItemDiscounts,
      combinesWithOrderDiscounts: input.combinesWithOrderDiscounts,
      combinesWithShippingDiscounts: input.combinesWithShippingDiscounts,
      startsAt,
      endsAt,
      allBranches: input.allBranches,
      branchIds: input.allBranches ? [] : [...new Set(input.branchIds)],
      channels: {
        posEnabled: input.posEnabled,
        customerMobileEnabled: input.customerMobileEnabled,
        deliveryEnabled: input.deliveryEnabled,
      },
      buyRequirementType:
        input.type === "buy_x_get_y" ? input.buyRequirementType : null,
      buyRequirementValue:
        input.type === "buy_x_get_y" ? input.buyRequirementValue.trim() : null,
      getQuantity:
        input.type === "buy_x_get_y" ? input.getQuantity.trim() : null,
      maxUsesPerOrder: input.type === "buy_x_get_y" ? maxUsesPerOrder : null,
      countryScope: input.type === "free_shipping" ? input.countryScope : "all",
      countryCodes:
        input.type === "free_shipping" && input.countryScope === "selected"
          ? countryCodes
          : [],
      maximumShippingPrice:
        input.type === "free_shipping" && maximumShippingPrice !== null
          ? input.maximumShippingPrice.trim()
          : null,
      tags,
      customerIds:
        input.eligibility === "specific_customers"
          ? [...new Set(input.customerIds)]
          : [],
      targets:
        input.type === "amount_off_order" || input.type === "free_shipping"
          ? []
          : targets,
    },
  };
}
