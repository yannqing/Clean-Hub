import { webAdminApi } from "@/lib/api-client";

import type { PriceBookFormValues } from "../types";
import { validatePriceBookForm } from "../validators";

export async function createPriceBookAction(input: PriceBookFormValues) {
  const validation = validatePriceBookForm(input);

  if (!validation.ok) {
    return validation;
  }

  const priceBook = await webAdminApi.tenant.prices.create(validation.data);

  return {
    ok: true as const,
    data: priceBook,
  };
}
