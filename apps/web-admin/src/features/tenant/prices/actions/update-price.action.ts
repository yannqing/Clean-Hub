import { webAdminApi } from "@/lib/api-client";

import type { PriceFormValues, PriceStatus } from "../types";
import { validatePriceUpdateForm } from "../validators";

export async function updatePriceAction(
  priceId: string,
  input: PriceFormValues,
) {
  const validation = validatePriceUpdateForm(input);

  if (!validation.ok) {
    return validation;
  }

  const price = await webAdminApi.tenant.prices.update(
    priceId,
    validation.data,
  );

  return {
    ok: true as const,
    data: price,
  };
}

export async function updatePriceStatusAction(
  priceId: string,
  status: PriceStatus,
) {
  const price = await webAdminApi.tenant.prices.update(priceId, {
    status,
  });

  return {
    ok: true as const,
    data: price,
  };
}
