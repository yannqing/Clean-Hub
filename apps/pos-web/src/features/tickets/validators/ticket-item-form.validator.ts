import type { ServiceTicketItemType } from "@cleanhub/api-client";

import type { TicketItemFormValues } from "../types";

export type TicketItemFormField = keyof TicketItemFormValues;
export type TicketItemFormFieldErrors = Partial<
  Record<TicketItemFormField, string>
>;

/**
 * Validate a ticket item create/edit form. The server requires `itemName` and
 * a non-negative `unitAmount`; quantity defaults to 1. We surface those rules
 * here so the form can show field-level errors before submitting.
 */
export function validateTicketItemForm(
  values: TicketItemFormValues,
): TicketItemFormFieldErrors | null {
  const errors: TicketItemFormFieldErrors = {};

  if (!values.itemName.trim()) {
    errors.itemName = "请输入物品名称";
  } else if (values.itemName.length > 200) {
    errors.itemName = "名称不能超过 200 字";
  }

  const quantity = Number(values.quantity);
  if (!values.quantity.trim() || !Number.isFinite(quantity)) {
    errors.quantity = "请输入数量";
  } else if (!Number.isInteger(quantity) || quantity < 1) {
    errors.quantity = "数量必须是大于等于 1 的整数";
  }

  const unitAmount = Number(values.unitAmount);
  if (!values.unitAmount.trim() || !Number.isFinite(unitAmount)) {
    errors.unitAmount = "请输入单价";
  } else if (unitAmount < 0) {
    errors.unitAmount = "单价不能为负";
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/** Coerce a raw string into a valid item type (or "" for "unspecified"). */
export function coerceTicketItemType(
  raw: unknown,
): ServiceTicketItemType | "" {
  return raw === "cloth" || raw === "car" || raw === "shoe" || raw === "carpet"
    ? raw
    : "";
}
