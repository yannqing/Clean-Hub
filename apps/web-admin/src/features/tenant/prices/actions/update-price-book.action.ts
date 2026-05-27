import { webAdminApi } from "@/lib/api-client";

import type { PriceBookFormValues, PriceBookStatus } from "../types";
import { validatePriceBookUpdateForm } from "../validators";

export async function updatePriceBookAction(
  priceBookId: string,
  input: PriceBookFormValues,
) {
  const validation = validatePriceBookUpdateForm(input);

  if (!validation.ok) {
    return validation;
  }

  const priceBook = await webAdminApi.tenant.prices.update(
    priceBookId,
    validation.data,
  );

  return {
    ok: true as const,
    data: priceBook,
  };
}

export async function deletePriceBookAction(priceBookId: string) {
  await webAdminApi.tenant.prices.remove(priceBookId);

  return {
    ok: true as const,
  };
}

export async function updatePriceBookStatusAction(
  priceBookId: string,
  status: PriceBookStatus,
) {
  const priceBook = await webAdminApi.tenant.prices.update(priceBookId, {
    status,
  });

  return {
    ok: true as const,
    data: priceBook,
  };
}
