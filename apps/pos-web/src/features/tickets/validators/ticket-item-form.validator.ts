import type { ServiceTicketItemType } from "@cleanhub/api-client";

import type { TicketItemFormValues } from "../types";

export type TicketItemFormField = keyof TicketItemFormValues;
export type TicketItemFormFieldErrors = Partial<
  Record<TicketItemFormField, string>
>;

/**
 * Validate catalog selection, measurement, and controlled price input before
 * the server repeats the same authorization and calculation checks.
 */
export function validateTicketItemForm(
  values: TicketItemFormValues,
): TicketItemFormFieldErrors | null {
  const errors: TicketItemFormFieldErrors = {};

  if (!values.itemType) {
    errors.itemType = "请先选择物品类型";
  }

  if (!values.serviceId) {
    errors.serviceId = "请选择服务项目";
  }

  if (values.pricingUnit === "per_kg") {
    const weight = Number(values.weight);
    if (!values.weight.trim() || !Number.isFinite(weight) || weight <= 0) {
      errors.weight = "请输入大于 0 的重量";
    }
    const bagCount = Number(values.bagCount);
    if (!Number.isInteger(bagCount) || bagCount < 1) {
      errors.bagCount = "袋数必须是大于等于 1 的整数";
    }
  } else {
    const quantity = Number(values.quantity);
    if (!values.quantity.trim() || !Number.isFinite(quantity)) {
      errors.quantity = "请输入数量";
    } else if (!Number.isInteger(quantity) || quantity < 1) {
      errors.quantity = "数量必须是大于等于 1 的整数";
    }
  }

  const chargedUnitAmount = Number(values.chargedUnitAmount);
  if (!values.chargedUnitAmount.trim() || !Number.isFinite(chargedUnitAmount)) {
    errors.chargedUnitAmount = "请输入收费单价";
  } else if (chargedUnitAmount < 0) {
    errors.chargedUnitAmount = "收费单价不能为负";
  }

  if (
    values.priceTouched &&
    Number(values.chargedUnitAmount).toFixed(2) !==
      Number(values.standardUnitAmount).toFixed(2) &&
    !values.overrideReason.trim()
  ) {
    errors.overrideReason = "覆盖标准价时必须填写原因";
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/** Coerce a raw string into a valid item type (or "" for "unspecified"). */
export function coerceTicketItemType(raw: unknown): ServiceTicketItemType | "" {
  return raw === "cloth" || raw === "car" || raw === "shoe" || raw === "carpet"
    ? raw
    : "";
}
