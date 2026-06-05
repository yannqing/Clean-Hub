import type { UpdatePriceRequest } from "@cleanhub/api-client";

import type { PriceFormValues, PriceStatus } from "../types";

const statuses: PriceStatus[] = ["active", "inactive"];

export type PriceFormValidationResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof PriceFormValues, string>>;
    };

export function validatePriceUpdateForm(
  input: PriceFormValues,
): PriceFormValidationResult<UpdatePriceRequest> {
  const errors: Partial<Record<keyof PriceFormValues, string>> = {};
  const amount = input.amount.trim();
  const currency = input.currency.trim().toUpperCase();

  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    errors.amount = "Amount must be greater than 0 with up to 2 decimals.";
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    errors.currency = "Currency must be a 3-letter code.";
  }

  if (!statuses.includes(input.status)) {
    errors.status = "Choose a supported status.";
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
      amount,
      currency,
      status: input.status,
    },
  };
}
