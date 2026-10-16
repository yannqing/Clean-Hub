import "server-only";

import type { ApiRequestOptions } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import type { TaxRate } from "../types";

export async function getTaxRatesQuery(
  requestOptions: Omit<ApiRequestOptions, "method" | "body">,
  includeArchived = true,
): Promise<TaxRate[]> {
  return webAdminApi.tenant.taxRates.list({ includeArchived }, requestOptions);
}
