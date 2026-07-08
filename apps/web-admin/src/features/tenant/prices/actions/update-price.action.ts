import { webAdminApi } from "@/lib/api-client";

import type {
  PriceFormValues,
  PriceStatus,
  PriceSummary,
} from "../types";
import { validatePriceUpdateForm } from "../validators";
import {
  getPriceActionError,
  type PriceActionError,
} from "./price-action-errors";

type PriceFormErrors = Partial<Record<keyof PriceFormValues, string>>;

export type UpdatePriceActionResult =
  | { ok: true; data: PriceSummary }
  | ({ ok: false } & PriceActionError & { errors: PriceFormErrors });

export async function updatePriceAction(
  priceId: string,
  input: PriceFormValues,
): Promise<UpdatePriceActionResult> {
  const validation = validatePriceUpdateForm(input);

  if (!validation.ok) {
    return {
      ok: false,
      message: "Check the price form.",
      errors: validation.errors,
    };
  }

  try {
    const price = await webAdminApi.tenant.prices.update(
      priceId,
      validation.data,
    );

    return {
      ok: true,
      data: price,
    };
  } catch (error) {
    return {
      ok: false,
      ...getPriceActionError(error, "Price could not be updated."),
      errors: {},
    };
  }
}

export type UpdatePriceStatusActionResult =
  | { ok: true; data: PriceSummary }
  | ({ ok: false } & PriceActionError);

export async function updatePriceStatusAction(
  priceId: string,
  status: PriceStatus,
  version: number,
): Promise<UpdatePriceStatusActionResult> {
  try {
    const price = await webAdminApi.tenant.prices.update(priceId, {
      status,
      version,
    });

    return {
      ok: true,
      data: price,
    };
  } catch (error) {
    return {
      ok: false,
      ...getPriceActionError(error, "Price status could not be updated."),
    };
  }
}
