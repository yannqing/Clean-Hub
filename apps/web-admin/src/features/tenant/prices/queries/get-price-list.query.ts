import { webAdminApi } from "@/lib/api-client";

import type { PriceListFilters, PriceSummary } from "../types";

export async function getPriceListQuery(
  filters: PriceListFilters = {},
): Promise<PriceSummary[]> {
  return webAdminApi.tenant.prices.list({
    ...filters,
    limit: 100,
    offset: 0,
  });
}
